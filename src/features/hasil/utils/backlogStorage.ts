import { offlineStore } from "../../../utils/offlineStore";
import { safeStorage } from "../../../utils/safeStorage";

/**
 * Prune historical dates from backlog object to keep the most recent N days for localStorage caching.
 * Full history is always preserved in IndexedDB (offlineStore) and backend database.
 */
export function pruneBacklogForLocalStorage<T = any>(
  history: Record<string, T>,
  maxDays = 60
): Record<string, T> {
  if (!history || typeof history !== 'object') return {};
  const dates = Object.keys(history).sort();
  if (dates.length <= maxDays) return history;

  const recentDates = dates.slice(-maxDays);
  const pruned: Record<string, T> = {};
  for (const d of recentDates) {
    pruned[d] = history[d];
  }
  return pruned;
}

/**
 * Get initial synchronous backlog data for an estate from localStorage.
 */
export function getInitialBacklogForEstate<T = any>(estateId: string): Record<string, T> {
  if (typeof window === "undefined" || !window.localStorage) {
    return safeStorage.getJSON(`fpm_backlog_history_${estateId}`, {});
  }

  const primaryKey = `fpm_backlog_history_${estateId}`;
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) {
      return JSON.parse(raw);
    }

    // Fallback to legacy key only if primary not found
    if (estateId === 'FPM_TUNGGAL') {
      const legacyRaw = localStorage.getItem("fpm_backlog_history_v1");
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        // Clean up legacy key to prevent future quota exhaustion
        try { localStorage.removeItem("fpm_backlog_history_v1"); } catch (_) {}
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[BacklogStorage] Failed to read initial backlog for ${estateId}:`, err);
  }

  return safeStorage.getJSON(primaryKey, {});
}

/**
 * Save backlog data with multi-layer resilience:
 * 1. Asynchronously save 100% full dataset to IndexedDB (offlineStore) which has gigabytes of storage quota.
 * 2. Save to localStorage with quota-exceeded guards and automatic pruning of legacy redundant keys.
 * 3. Gracefully fall back to in-memory safeStorage if localStorage is completely saturated by other browser data.
 */
export async function saveBacklogHistoryLocally<T = any>(
  estateId: string,
  updatedHistory: Record<string, T>
): Promise<void> {
  const primaryKey = `fpm_backlog_history_${estateId}`;

  // 1. Primary durable local store: IndexedDB (never hits 5MB quota)
  try {
    await offlineStore.setItem(primaryKey, updatedHistory);
  } catch (idbErr) {
    console.warn("[BacklogStorage] IndexedDB offlineStore save warning:", idbErr);
  }

  // Also keep memory fallback synced
  safeStorage.setJSON(primaryKey, updatedHistory);

  // 2. Synchronous cache in localStorage for fast initial render
  if (typeof window === "undefined" || !window.localStorage) return;

  // Always remove the redundant legacy duplicate key to reclaim 1-2MB of quota immediately
  try {
    if (localStorage.getItem("fpm_backlog_history_v1")) {
      localStorage.removeItem("fpm_backlog_history_v1");
    }
  } catch (_) {}

  // Attempt standard write
  try {
    localStorage.setItem(primaryKey, JSON.stringify(updatedHistory));
    return;
  } catch (quotaErr: any) {
    console.warn(`[BacklogStorage] localStorage quota reached while saving ${primaryKey}. Pruning older entries for localStorage cache...`);
  }

  // Attempt write with 60-day pruned window
  try {
    const pruned60 = pruneBacklogForLocalStorage(updatedHistory, 60);
    localStorage.setItem(primaryKey, JSON.stringify(pruned60));
    return;
  } catch (_) {}

  // Attempt write with 30-day pruned window
  try {
    const pruned30 = pruneBacklogForLocalStorage(updatedHistory, 30);
    localStorage.setItem(primaryKey, JSON.stringify(pruned30));
    return;
  } catch (_) {}

  // Final fallback: keep only last 14 days in localStorage, everything else is in IndexedDB & server
  try {
    const pruned14 = pruneBacklogForLocalStorage(updatedHistory, 14);
    localStorage.setItem(primaryKey, JSON.stringify(pruned14));
  } catch (finalErr) {
    console.warn("[BacklogStorage] localStorage fully saturated by other storage items. IndexedDB holds full historical data.", finalErr);
  }
}
