import { Worker, AttendanceRecord, WorkAssignment } from './types';
import { getActiveEstateId } from '../../utils/estateContext';
import { safeFetch } from '../../utils/safeFetch';

/**
 * P0-16 follow-up: all pekerja data access goes through the authenticated
 * server API proxy (src/server/routes/workers.routes.ts) instead of the browser
 * Supabase client. The Sep-10 anon revocation + RLS hardening blocks direct
 * browser access to public.workers / work_assignments / attendance_records.
 *
 * Existing public function signatures and return shapes are preserved. Where no
 * authenticated backend endpoint exists yet (attendance records and
 * work-assignment writes), the pre-existing local-storage behaviour is kept and
 * no direct Supabase call is made.
 */

const WORKERS_API = '/api/workers/workers';
const WORK_ASSIGNMENTS_API = '/api/workers/work-assignments';
const ATTENDANCE_API = '/api/workers/attendance';

const apiHeaders = (estateId: string, json = false): Record<string, string> => {
  const headers: Record<string, string> = { 'x-estate-id': estateId };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
};

async function apiListOrThrow(url: string, estateId: string): Promise<any[]> {
  const res = await safeFetch(url, { headers: apiHeaders(estateId) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `API request failed (${res.status})`);
  }
  return Array.isArray(json?.data) ? json.data : [];
}

async function apiListOrEmpty(url: string, estateId: string): Promise<any[]> {
  try {
    return await apiListOrThrow(url, estateId);
  } catch (err: any) {
    console.warn('Failed to fetch from workers API:', err?.message || err);
    return [];
  }
}

/**
 * POST JSON to the authenticated API. Throws on any non-success response so an
 * unsuccessful server write is never reported as success by the caller.
 */
async function apiPostJson(url: string, body: any, estateId: string): Promise<any> {
  const res = await safeFetch(url, {
    method: 'POST',
    headers: apiHeaders(estateId, true),
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `Permintaan API gagal (${res.status}).`);
  }
  return json;
}

async function postWorker(payload: any, estateId: string): Promise<Worker> {
  const res = await safeFetch(WORKERS_API, {
    method: 'POST',
    headers: apiHeaders(estateId, true),
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) {
    throw new Error(json?.error || 'Gagal menyimpan maklumat pekerja.');
  }
  return json.data as Worker;
}

async function patchWorker(workerId: string, fields: Partial<Worker>, estateId: string, fallbackMessage: string): Promise<Worker> {
  // The workers API upserts, and workers.worker_no/name/role/estate_id are NOT
  // NULL, so merge with the current record to preserve required columns.
  const list = await apiListOrThrow(WORKERS_API, estateId);
  const current: any = list.find((w: any) => String(w.id) === String(workerId)) || {};
  const payload = {
    ...current,
    ...fields,
    id: workerId,
    estate_id: current.estate_id || estateId
  };
  const res = await safeFetch(WORKERS_API, {
    method: 'POST',
    headers: apiHeaders(estateId, true),
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) {
    throw new Error(json?.error || fallbackMessage);
  }
  return json.data as Worker;
}

export const getWorkers = async () => {
  const activeEstateId = getActiveEstateId();
  const getCachedWorkers = () => {
    const localStr = localStorage.getItem(`fpm_local_workers_${activeEstateId}`);
    if (localStr) {
      try { return JSON.parse(localStr); } catch (e) {}
    }
    if (activeEstateId === 'FPM_TUNGGAL') {
      const legacyStr = localStorage.getItem('fpm_local_workers_v1');
      if (legacyStr) {
        try { return JSON.parse(legacyStr); } catch (e) {}
      }
    }
    return [];
  };

  try {
    const data = await apiListOrThrow(WORKERS_API, activeEstateId);
    if (data && data.length > 0) {
      const filtered = data.filter((w: any) => {
        if (activeEstateId === 'FPM_TUNGGAL') {
          return !w.estate_id || w.estate_id === 'FPM_TUNGGAL';
        }
        return w.estate_id === activeEstateId;
      });
      if (filtered.length > 0) {
        // Auto-upload unsynced local offline workers to Supabase
        const cached = getCachedWorkers();
        const unSyncedLocalWorkers = cached.filter((cw: any) => 
          cw && (
            (String(cw.id).startsWith('local_worker_')) || 
            !filtered.some((f: any) => f.name?.trim().toLowerCase() === cw.name?.trim().toLowerCase())
          )
        );

        if (unSyncedLocalWorkers.length > 0) {
          (async () => {
            for (const lw of unSyncedLocalWorkers) {
              try {
                const { id, ...workerData } = lw;
                await postWorker({
                  ...workerData,
                  estate_id: activeEstateId
                }, activeEstateId);
              } catch (_) {}
            }
          })();
        }

        localStorage.setItem(`fpm_local_workers_${activeEstateId}`, JSON.stringify(filtered));
        return filtered as Worker[];
      }
      // If filtered is empty for activeEstateId, check if we have local workers before wiping
      const localWorkers = getCachedWorkers();
      if (localWorkers.length > 0) {
        return localWorkers;
      }
      localStorage.setItem(`fpm_local_workers_${activeEstateId}`, JSON.stringify([]));
      return [] as Worker[];
    }
    return getCachedWorkers();
  } catch (e) {
    console.warn("Failed to fetch workers from API:", e);
    return getCachedWorkers();
  }
};

export const saveWorker = async (worker: Partial<Worker>) => {
  const activeEstateId = getActiveEstateId();
  const workerWithEstate = { 
    ...worker, 
    estate_id: (worker as any).estate_id || activeEstateId 
  };

  // Local caching fallback
  const saveToLocal = (w: any) => {
    try {
      const localStr = localStorage.getItem(`fpm_local_workers_${activeEstateId}`);
      const list = localStr ? JSON.parse(localStr) : [];
      const updated = [...list.filter((item: any) => item.id !== w.id), w];
      localStorage.setItem(`fpm_local_workers_${activeEstateId}`, JSON.stringify(updated));
    } catch (_) {}
  };

  try {
    const saved = await postWorker(workerWithEstate, activeEstateId);
    saveToLocal(saved);
    return saved;
  } catch (err: any) {
    const errMsg = String(err.message || '').toLowerCase();
    if (errMsg.includes('kumpulan') || errMsg.includes('negara_asal') || errMsg.includes('schema cache')) {
      console.warn("Retrying saveWorker without kumpulan/negara_asal due to missing columns", err.message);
      const { kumpulan, negara_asal, ...safeWorker } = worker;
      const safeWorkerWithEstate = { ...safeWorker, estate_id: (safeWorker as any).estate_id || activeEstateId };
      try {
        const saved = await postWorker(safeWorkerWithEstate, activeEstateId);
        saveToLocal(saved);
        return saved;
      } catch (retryErr: any) {
        console.warn("Save to API failed, saving locally:", retryErr.message);
      }
    }
    const mockId = (worker as any).id || `local_worker_${Date.now()}`;
    const localWorker = { ...workerWithEstate, id: mockId } as Worker;
    saveToLocal(localWorker);
    return localWorker;
  }
};

export const toggleWorkerStatus = async (workerId: string, isActive: boolean) => {
  const activeEstateId = getActiveEstateId();
  return patchWorker(workerId, { is_active: isActive }, activeEstateId, 'Gagal mengemas kini status pekerja.');
};

export const updateWorkerRole = async (workerId: string, role: string) => {
  const activeEstateId = getActiveEstateId();
  return patchWorker(workerId, { role }, activeEstateId, 'Gagal mengemas kini peranan pekerja.');
};

export const getAttendanceForDate = async (date: string) => {
  const activeEstateId = getActiveEstateId();
  let data: any[] = [];

  try {
    const res = await safeFetch(`${ATTENDANCE_API}?date=${encodeURIComponent(date)}`, { headers: apiHeaders(activeEstateId) });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data)) {
        data = json.data;
        if (data.length > 0) {
          try { localStorage.setItem(`fpm_attendance_${activeEstateId}_${date}`, JSON.stringify(data)); } catch (_) {}
        }
      }
    }
  } catch (err: any) {
    console.warn('Failed to fetch attendance from API:', err?.message || err);
  }

  // Secondary offline cache fallback (read-only; never masks a write failure).
  if (!data || data.length === 0) {
    try {
      const localStr = localStorage.getItem(`fpm_attendance_${activeEstateId}_${date}`) || localStorage.getItem(`fpm_attendance_${date}`);
      if (localStr) {
        data = JSON.parse(localStr);
      }
    } catch (_) {}
  }

  const filtered = (data || []).filter((r: any) => {
    if (!r.estate_id || activeEstateId === 'FPM_TUNGGAL') {
      return !r.estate_id || r.estate_id === 'FPM_TUNGGAL' || (r.worker && (!r.worker.estate_id || r.worker.estate_id === 'FPM_TUNGGAL'));
    }
    return r.estate_id === activeEstateId || (r.worker && r.worker.estate_id === activeEstateId);
  });
  return filtered as AttendanceRecord[];
};

export const getAttendanceForMonth = async (yearStr: string, monthStr: string) => {
  const activeEstateId = getActiveEstateId();
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = lastDay.toString().padStart(2, '0');
  const from = `${yearStr}-${monthStr}-01`;
  const to = `${yearStr}-${monthStr}-${lastDayStr}`;

  let data: any[] = [];

  try {
    const res = await safeFetch(`${ATTENDANCE_API}?from=${from}&to=${to}`, { headers: apiHeaders(activeEstateId) });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data)) {
        data = json.data;
      }
    }
  } catch (err: any) {
    console.warn('Failed to fetch monthly attendance from API:', err?.message || err);
  }

  // Secondary offline cache fallback (read-only).
  if (!data || data.length === 0) {
    try {
      const localRecords: any[] = [];
      for (let day = 1; day <= lastDay; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
        const localStr = localStorage.getItem(`fpm_attendance_${activeEstateId}_${dateKey}`) || localStorage.getItem(`fpm_attendance_${dateKey}`);
        if (localStr) {
          const parsed = JSON.parse(localStr);
          if (Array.isArray(parsed)) {
            localRecords.push(...parsed);
          }
        }
      }
      if (localRecords.length > 0) {
        data = localRecords;
      }
    } catch (_) {}
  }

  const filtered = (data || []).filter((r: any) => {
    if (!r.estate_id || activeEstateId === 'FPM_TUNGGAL') {
      return !r.estate_id || r.estate_id === 'FPM_TUNGGAL';
    }
    return r.estate_id === activeEstateId;
  });
  return filtered as AttendanceRecord[];
};

export const getWorkAssignmentsForMonth = async (yearStr: string, monthStr: string) => {
  const activeEstateId = getActiveEstateId();
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = lastDay.toString().padStart(2, '0');
  const from = `${yearStr}-${monthStr}-01`;
  const to = `${yearStr}-${monthStr}-${lastDayStr}`;

  const data = await apiListOrThrow(WORK_ASSIGNMENTS_API, activeEstateId);
  const inRange = (data || []).filter((r: any) => {
    const d = String(r.date || '').split('T')[0];
    return d >= from && d <= to;
  });
  const filtered = inRange.filter((r: any) => {
    if (activeEstateId === 'FPM_TUNGGAL') {
      return !r.estate_id || r.estate_id === 'FPM_TUNGGAL' || (r.worker && (!r.worker.estate_id || r.worker.estate_id === 'FPM_TUNGGAL'));
    }
    return r.estate_id === activeEstateId || (r.worker && r.worker.estate_id === activeEstateId);
  });
  return filtered as WorkAssignment[];
};

export const upsertAttendance = async (records: Partial<AttendanceRecord>[]) => {
  const activeEstateId = getActiveEstateId();

  // Secondary offline cache (never treated as authoritative success).
  const dateKey = records.length > 0 && records[0].date ? records[0].date : '';
  if (dateKey) {
    try {
      localStorage.setItem(`fpm_attendance_${activeEstateId}_${dateKey}`, JSON.stringify(records));
      if (activeEstateId === 'FPM_TUNGGAL') {
        localStorage.setItem(`fpm_attendance_${dateKey}`, JSON.stringify(records));
      }
    } catch (_) {}
  }

  // Authoritative persistence: authenticated API -> server-side privileged client -> PostgreSQL.
  // Any failure throws so an unsuccessful server write is never shown as success.
  const payload = {
    records: records.map(({ worker, ...r }: any) => ({
      id: r.id,
      worker_id: r.worker_id,
      date: r.date,
      status: r.status
    }))
  };
  const json = await apiPostJson(ATTENDANCE_API, payload, activeEstateId);
  const saved = Array.isArray(json?.data) ? json.data : [];
  return (saved.length > 0 ? saved : records) as AttendanceRecord[];
};

export const updateWorkerNegara = async (workerId: string, negaraAsal: string) => {
  const activeEstateId = getActiveEstateId();
  try {
    return await patchWorker(workerId, { negara_asal: negaraAsal }, activeEstateId, 'Gagal mengemas kini negara asal pekerja.');
  } catch (err: any) {
    const errMsg = String(err.message || '').toLowerCase();
    if (errMsg.includes('negara_asal') || errMsg.includes('schema cache')) {
      console.warn("Skipping negara_asal update as column might not exist:", err.message);
      const list = await apiListOrEmpty(WORKERS_API, activeEstateId);
      const current = list.find((w: any) => String(w.id) === String(workerId));
      return (current || { id: workerId }) as Worker;
    }
    throw err;
  }
};

export const updateWorkerKumpulan = async (workerId: string, kumpulan: string) => {
  const activeEstateId = getActiveEstateId();
  try {
    return await patchWorker(workerId, { kumpulan }, activeEstateId, 'Gagal mengemas kini kumpulan pekerja.');
  } catch (err: any) {
    const errMsg = String(err.message || '').toLowerCase();
    if (errMsg.includes('kumpulan') || errMsg.includes('schema cache')) {
      console.warn("Skipping kumpulan update as column might not exist:", err.message);
      const list = await apiListOrEmpty(WORKERS_API, activeEstateId);
      const current = list.find((w: any) => String(w.id) === String(workerId));
      return (current || { id: workerId }) as Worker;
    }
    throw err;
  }
};

export const deleteWorker = async (workerId: string) => {
  const activeEstateId = getActiveEstateId();
  const res = await safeFetch(`${WORKERS_API}/${encodeURIComponent(workerId)}`, {
    method: 'DELETE',
    headers: apiHeaders(activeEstateId)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || 'Gagal memadam pekerja.');
  }
};

export const updateWorker = async (workerId: string, updates: Partial<Worker>) => {
  const activeEstateId = getActiveEstateId();
  try {
    return await patchWorker(workerId, updates, activeEstateId, 'Gagal mengemas kini pekerja.');
  } catch (err: any) {
    const errMsg = String(err.message || '').toLowerCase();
    if (errMsg.includes('kumpulan') || errMsg.includes('negara_asal') || errMsg.includes('schema cache')) {
      console.warn("Retrying updateWorker without kumpulan/negara_asal due to missing columns", err.message);
      const { kumpulan, negara_asal, ...safeUpdates } = updates;
      return patchWorker(workerId, safeUpdates, activeEstateId, 'Gagal mengemas kini pekerja.');
    }
    throw err;
  }
};

export const getWorkAssignmentsForDate = async (date: string) => {
  const activeEstateId = getActiveEstateId();
  let results: WorkAssignment[] = [];

  try {
    const data = await apiListOrThrow(WORK_ASSIGNMENTS_API, activeEstateId);
    // Match both plain `YYYY-MM-DD` and ISO timestamp values by normalising to the date part.
    const exact = data.filter((r: any) => String(r.date || '').split('T')[0] === date);
    if (exact.length > 0) {
      results = exact as WorkAssignment[];
    }
  } catch (err) {
    console.warn("API fetch error for getWorkAssignmentsForDate:", err);
  }

  if (results.length === 0) {
    // Local storage fallback
    try {
      const localStr = localStorage.getItem(`fpm_work_assignments_${activeEstateId}_${date}`);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (Array.isArray(parsed)) {
          results = parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Filter by active Estate ID
  results = results.filter((r: any) => {
    if (activeEstateId === 'FPM_TUNGGAL') {
      return !r.estate_id || r.estate_id === 'FPM_TUNGGAL' || (r.worker && (!r.worker.estate_id || r.worker.estate_id === 'FPM_TUNGGAL'));
    }
    return r.estate_id === activeEstateId || (r.worker && r.worker.estate_id === activeEstateId);
  });

  return results;
};

export const getLatestWorkAssignmentsBeforeDate = async (targetDate: string) => {
  const activeEstateId = getActiveEstateId();
  let results: WorkAssignment[] = [];
  let foundDate = '';

  try {
    const data = await apiListOrThrow(WORK_ASSIGNMENTS_API, activeEstateId);
    const before = data
      .filter((r: any) => String(r.date || '').split('T')[0] < targetDate)
      .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 100);

    if (before.length > 0) {
      const latestDateStr = String(before[0].date || '').split('T')[0] || '';
      if (latestDateStr) {
        foundDate = latestDateStr;
        results = before.filter((row: any) => (String(row.date || '').split('T')[0] || '') === latestDateStr) as WorkAssignment[];
      }
    }
  } catch (err) {
    console.warn("API query error for getLatestWorkAssignmentsBeforeDate:", err);
  }

  // Fallback scan local storage up to 60 days back
  if (results.length === 0) {
    const [sYear, sMonth, sDay] = targetDate.split('-').map(Number);
    for (let i = 1; i <= 60; i++) {
      const testDate = new Date(sYear, sMonth - 1, sDay);
      testDate.setDate(testDate.getDate() - i);
      const dateStr = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`;
      const localStr = localStorage.getItem(`fpm_work_assignments_${activeEstateId}_${dateStr}`);
      if (localStr) {
        try {
          const parsed = JSON.parse(localStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            results = parsed;
            foundDate = dateStr;
            break;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  // Filter by active Estate ID
  results = results.filter((r: any) => {
    if (activeEstateId === 'FPM_TUNGGAL') {
      return !r.estate_id || r.estate_id === 'FPM_TUNGGAL' || (r.worker && (!r.worker.estate_id || r.worker.estate_id === 'FPM_TUNGGAL'));
    }
    return r.estate_id === activeEstateId || (r.worker && r.worker.estate_id === activeEstateId);
  });

  return { assignments: results, date: foundDate };
};

export const saveWorkAssignment = async (assignment: Partial<WorkAssignment>) => {
  const activeEstateId = getActiveEstateId();
  const { worker, ...rest } = assignment as any;
  const item = { ...rest, estate_id: rest.estate_id || activeEstateId };
  // Authoritative persistence via the authenticated API (throws on failure).
  const json = await apiPostJson(WORK_ASSIGNMENTS_API, { assignments: [item] }, activeEstateId);
  const saved = Array.isArray(json?.data) && json.data[0] ? json.data[0] : item;
  return saved as unknown as Worker;
};

export const saveWorkAssignmentsBatch = async (date: string, assignments: Partial<WorkAssignment>[]) => {
  const activeEstateId = getActiveEstateId();
  // Secondary offline cache (never treated as authoritative success).
  try {
    localStorage.setItem(`fpm_work_assignments_${activeEstateId}_${date}`, JSON.stringify(assignments));
    if (activeEstateId === 'FPM_TUNGGAL') {
      localStorage.setItem(`fpm_work_assignments_${date}`, JSON.stringify(assignments));
    }
  } catch (e) {
    console.error("Failed saving work assignments to localStorage:", e);
  }

  // Authoritative persistence: authenticated API replaces the day's assignment
  // set server-side (upsert-then-reconcile; never delete-then-reinsert).
  const toSave = assignments.map((a: any) => {
    const { worker, ...rest } = a;
    return { ...rest, date };
  });
  const json = await apiPostJson(WORK_ASSIGNMENTS_API, { date, replaceDate: true, assignments: toSave }, activeEstateId);
  const saved = Array.isArray(json?.data) ? json.data : [];
  return (saved.length > 0 ? saved : toSave) as WorkAssignment[];
};

export const upsertWorkAssignmentSingle = async (assignment: Partial<WorkAssignment>) => {
  const activeEstateId = getActiveEstateId();
  const { id, worker, ...rest } = assignment as any;
  const item = { ...rest, id, estate_id: rest.estate_id || activeEstateId };
  // Authoritative persistence via the authenticated API (throws on failure).
  const json = await apiPostJson(WORK_ASSIGNMENTS_API, { assignments: [item] }, activeEstateId);
  const saved = Array.isArray(json?.data) && json.data[0] ? json.data[0] : item;
  return saved as WorkAssignment;
};
