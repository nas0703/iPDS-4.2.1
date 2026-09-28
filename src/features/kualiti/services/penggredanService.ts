import { BlockGradingSession, normalizeLorryNo } from '../types/penggredan';
import { getActiveEstateId } from '../../../utils/estateContext';
import { safeFetch } from '../../../utils/safeFetch';

const getDeletedIds = (estateId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`fpmsb_penggredan_deleted_${estateId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (_) {}
  return new Set();
};

const addDeletedId = (estateId: string, id: string): void => {
  try {
    const set = getDeletedIds(estateId);
    set.add(id);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(`fpmsb_penggredan_deleted_${estateId}`, JSON.stringify(arr));
  } catch (_) {}
};

const removeDeletedId = (estateId: string, id: string): void => {
  try {
    const set = getDeletedIds(estateId);
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(`fpmsb_penggredan_deleted_${estateId}`, JSON.stringify(Array.from(set)));
    }
  } catch (_) {}
};

export const penggredanService = {
  // Fetch history sessions from API proxy with localStorage fallback & auto-sync of offline records
  async getSessions(): Promise<BlockGradingSession[]> {
    const activeEstateId = getActiveEstateId();
    const storageKey = `fpmsb_penggredan_sessions_${activeEstateId}`;
    const deletedIds = getDeletedIds(activeEstateId);
    let localSessions: BlockGradingSession[] = [];

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out test records, deleted records, and normalize lorry numbers
          localSessions = parsed
            .filter((s: any) => !s.id?.toLowerCase().includes('test') && !s.noLori?.toUpperCase().includes('TEST') && !deletedIds.has(s.id))
            .map((s: any) => ({
              ...s,
              noLori: normalizeLorryNo(s.noLori) || s.noLori
            }));
        }
      }
    } catch (e) {
      console.error("Gagal membaca localStorage penggredan:", e);
    }

    try {
      const res = await safeFetch(`/api/penggredan?estate_id=${encodeURIComponent(activeEstateId)}`);

      if (!res.ok) {
        console.warn("API fetch notice (menggunakan rekod tempatan):", res.statusText);
        return localSessions.filter(s => !deletedIds.has(s.id));
      }

      const json = await res.json();
      const data = json.data || [];

      if (Array.isArray(data)) {
        // Authoritative records from Supabase
        const mappedData: BlockGradingSession[] = data
          .filter((item: any) =>
            !item.id?.toLowerCase().includes('test') &&
            !item.no_lori?.toUpperCase().includes('TEST') &&
            !deletedIds.has(item.id)
          )
          .map((item: any) => ({
            id: item.id || `session-${Date.now()}`,
            tajuk: item.tajuk || '*JPPK KS ADELA*',
            program: item.program || 'Task Force Grading',
            jenisGrading: item.jenis_grading || item.jenisGrading || 'Grading Di ladang',
            tarikh: item.tarikh || '',
            ladang: item.ladang || '',
            peringkatBlok: item.peringkat_blok || item.peringkatBlok || '',
            noLori: normalizeLorryNo(item.no_lori || item.noLori || '') || (item.no_lori || item.noLori || ''),
            namaPenggred: item.nama_penggred || item.namaPenggred || '',
            gradingTaskId: item.grading_task_id || item.gradingTaskId || undefined,
            platforms: Array.isArray(item.platforms) ? item.platforms : (typeof item.platforms === 'string' ? JSON.parse(item.platforms) : []),
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
            _isPendingSync: false
          }));

        const remoteIds = new Set(mappedData.map(s => s.id));
        const mergedMap = new Map<string, BlockGradingSession>();
        mappedData.forEach(s => mergedMap.set(s.id, s));

        // CRITICAL SYNC RULE:
        // Keep local records that were created on THIS device (_isPendingSync === true or un-synced draft)
        // and are not deleted. Any record confirmed synced (_isPendingSync === false) that is missing from Supabase
        // was DELETED remotely, and will be pruned from local cache.
        const pendingOfflineSyncs: BlockGradingSession[] = [];
        localSessions.forEach(s => {
          if (!deletedIds.has(s.id)) {
            if (!remoteIds.has(s.id)) {
              if (s._isPendingSync === true || s._isPendingSync === undefined) {
                mergedMap.set(s.id, s);
                pendingOfflineSyncs.push(s);
              }
            }
          }
        });

        // Trigger background sync for pending offline drafts
        if (pendingOfflineSyncs.length > 0) {
          pendingOfflineSyncs.forEach(session => {
            void penggredanService.saveSession(session).catch(e => {
              console.warn("Background sync of offline grading record deferred:", e);
            });
          });
        }

        const mergedList = Array.from(mergedMap.values()).sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

        // Safeguard: Deduplicate any legacy twin records created within 5 minutes of each other with identical lorry, block, date & totals
        const dedupedList: BlockGradingSession[] = [];
        const seenFingerprints = new Map<string, BlockGradingSession>();

        for (const session of mergedList) {
          const loriNorm = (session.noLori || '').replace(/\s+/g, '').toUpperCase();
          const blokNorm = (session.peringkatBlok || '').replace(/\s+/g, '').toUpperCase();
          const totalGred = session.platforms?.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0) || 0;
          const fp = `${session.tarikh}|${loriNorm}|${blokNorm}|${totalGred}`;

          if (seenFingerprints.has(fp)) {
            const existing = seenFingerprints.get(fp)!;
            const diffMs = Math.abs(new Date(existing.createdAt || 0).getTime() - new Date(session.createdAt || 0).getTime());
            if (diffMs < 1000 * 60 * 5) {
              continue;
            }
          }
          seenFingerprints.set(fp, session);
          dedupedList.push(session);
        }

        // Update local storage so deleted records and redundant duplicates are permanently purged from this device too
        try {
          localStorage.setItem(storageKey, JSON.stringify(dedupedList));
        } catch (e) {}

        return dedupedList;
      }
    } catch (err) {
      console.warn("Ralat sambungan API penggredan:", err);
    }

    // Local fallback with deduplication
    const fallbackList = localSessions.filter(s => !deletedIds.has(s.id));
    const dedupedFallback: BlockGradingSession[] = [];
    const seenFallbackFp = new Map<string, BlockGradingSession>();

    for (const session of fallbackList) {
      const loriNorm = (session.noLori || '').replace(/\s+/g, '').toUpperCase();
      const blokNorm = (session.peringkatBlok || '').replace(/\s+/g, '').toUpperCase();
      const totalGred = session.platforms?.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0) || 0;
      const fp = `${session.tarikh}|${loriNorm}|${blokNorm}|${totalGred}`;

      if (seenFallbackFp.has(fp)) {
        const existing = seenFallbackFp.get(fp)!;
        const diffMs = Math.abs(new Date(existing.createdAt || 0).getTime() - new Date(session.createdAt || 0).getTime());
        if (diffMs < 1000 * 60 * 5) {
          continue;
        }
      }
      seenFallbackFp.set(fp, session);
      dedupedFallback.push(session);
    }

    return dedupedFallback;
  },

  // Save session via API proxy & localStorage
  async saveSession(session: BlockGradingSession): Promise<{ success: boolean; isSupabaseSynced: boolean; message: string }> {
    const activeEstateId = getActiveEstateId();
    const storageKey = `fpmsb_penggredan_sessions_${activeEstateId}`;

    // If re-saving a session, ensure it's not marked as deleted
    removeDeletedId(activeEstateId, session.id);

    let currentLocal: BlockGradingSession[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        currentLocal = JSON.parse(saved);
      }
    } catch (e) {}

    const sessionToStore: BlockGradingSession = {
      ...session,
      _isPendingSync: true
    };

    const existingIdx = currentLocal.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      currentLocal[existingIdx] = sessionToStore;
    } else {
      currentLocal = [sessionToStore, ...currentLocal];
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(currentLocal));
    } catch (e) {
      console.error("Local storage write error:", e);
    }

    try {
      const dbPayload = {
        id: session.id,
        tajuk: session.tajuk,
        program: session.program,
        jenis_grading: session.jenisGrading,
        tarikh: session.tarikh,
        ladang: session.ladang,
        estate_id: activeEstateId,
        peringkat_blok: session.peringkatBlok,
        no_lori: session.noLori,
        nama_penggred: session.namaPenggred,
        platforms: session.platforms,
        total_di_gred: session.platforms.reduce((a, b) => a + Number(b.tandanDiGred || 0), 0),
        total_di_tinggal: session.platforms.reduce((a, b) => a + Number(b.tandanDiTinggal || 0), 0),
        total_di_bawa: session.platforms.reduce((a, b) => a + Number(b.tandanDiBawa || 0), 0),
        created_at: session.createdAt || new Date().toISOString()
      };

      const res = await safeFetch('/api/penggredan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbPayload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn("Gagal menghantar rekod ke Supabase:", res.status, errText);
        return {
          success: false,
          isSupabaseSynced: false,
          message: `Disimpan Tempatan Sahaja (Gagal Pelayan: ${res.status})`
        };
      }

      const resJson = await res.json().catch(() => ({}));
      const isSupabaseSuccess = resJson.isSupabaseSuccess ?? true;

      // Mark as confirmed and synced locally
      if (isSupabaseSuccess) {
        sessionToStore._isPendingSync = false;
        const updatedIdx = currentLocal.findIndex(s => s.id === session.id);
        if (updatedIdx >= 0) {
          currentLocal[updatedIdx] = sessionToStore;
          try {
            localStorage.setItem(storageKey, JSON.stringify(currentLocal));
          } catch (_) {}
        }
      }

      return {
        success: isSupabaseSuccess,
        isSupabaseSynced: isSupabaseSuccess,
        message: isSupabaseSuccess
          ? 'Berjaya disimpan ke Pangkalan Data Supabase & Tempatan!'
          : 'Disimpan secara Tempatan sahaja (Sila semak ralat RLS/Sesi pada server).'
      };
    } catch (err: any) {
      console.error("API write exception:", err);
      return {
        success: false,
        isSupabaseSynced: false,
        message: 'Gagal sambungan API. Disimpan secara tempatan dalam peranti.'
      };
    }
  },

  // Delete session via API proxy & localStorage
  async deleteSession(id: string): Promise<boolean> {
    const activeEstateId = getActiveEstateId();
    const storageKey = `fpmsb_penggredan_sessions_${activeEstateId}`;

    // 1. Record ID in local deleted tombstones immediately
    addDeletedId(activeEstateId, id);

    // 2. Remove immediately from local sessions
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const currentLocal: BlockGradingSession[] = JSON.parse(saved);
        const updated = currentLocal.filter(s => s.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    } catch (e) {}

    // 3. Delete from Supabase & server JSON cache via API
    try {
      const res = await safeFetch(`/api/penggredan/${encodeURIComponent(id)}?estate_id=${encodeURIComponent(activeEstateId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        console.warn("API delete response not ok:", res.status);
      }
    } catch (e) {
      console.warn("Gagal memadam rekod di Supabase:", e);
    }

    return true;
  }
};

