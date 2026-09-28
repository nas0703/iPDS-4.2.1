/**
 * Offline Store Engine using IndexedDB & LocalStorage Fallback
 * Provides persistent offline cache for transaction data, reports, and sync queues.
 */

const DB_NAME = 'ipds_offline_db';
const DB_VERSION = 1;

export interface OfflineSyncQueueItem {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload: any;
  timestamp: number;
}

class OfflineStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          // Store for caching key-value records (transactions, reports, settings)
          if (!db.objectStoreNames.contains('keyval')) {
            db.createObjectStore('keyval');
          }
          // Store for offline pending sync queue (mutations made while offline)
          if (!db.objectStoreNames.contains('sync_queue')) {
            db.createObjectStore('sync_queue', { keyPath: 'id' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (err) => {
          console.warn('[OfflineStore] IndexedDB open error, using localStorage fallback:', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineStore] IndexedDB initialization exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Set key-value data in IndexedDB with localStorage fallback
   */
  public async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.initDB();
      if (db) {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (err) {
      console.warn(`[OfflineStore] Failed to write key "${key}" to IndexedDB:`, err);
    }

    // LocalStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`ipds_idb_${key}`, JSON.stringify(value));
      }
    } catch (lsErr) {
      console.warn(`[OfflineStore] LocalStorage fallback write failed for "${key}":`, lsErr);
    }
  }

  /**
   * Get key-value data from IndexedDB with localStorage fallback
   */
  public async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const db = await this.initDB();
      if (db) {
        const result = await new Promise<T | undefined>((resolve, reject) => {
          const tx = db.transaction('keyval', 'readonly');
          const store = tx.objectStore('keyval');
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (result !== undefined && result !== null) {
          return result;
        }
      }
    } catch (err) {
      console.warn(`[OfflineStore] Failed to read key "${key}" from IndexedDB:`, err);
    }

    // LocalStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`ipds_idb_${key}`);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch (_) {}

    return defaultValue;
  }

  /**
   * Remove key-value data from IndexedDB with localStorage fallback
   */
  public async removeItem(key: string): Promise<void> {
    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('keyval', 'readwrite');
          const store = tx.objectStore('keyval');
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (err) {
      console.warn(`[OfflineStore] Failed to remove key "${key}" from IndexedDB:`, err);
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`ipds_idb_${key}`);
      }
    } catch (_) {}
  }

  /**
   * Add a request to offline sync queue
   */
  public async enqueueSync(item: Omit<OfflineSyncQueueItem, 'id' | 'timestamp'>): Promise<string> {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullItem: OfflineSyncQueueItem = {
      ...item,
      id,
      timestamp: Date.now(),
    };

    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('sync_queue', 'readwrite');
          const store = tx.objectStore('sync_queue');
          const req = store.put(fullItem);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        return id;
      }
    } catch (err) {
      console.warn('[OfflineStore] Failed to enqueue sync to IndexedDB:', err);
    }

    // Fallback to localStorage
    try {
      const existingQueue = JSON.parse(window.localStorage.getItem('ipds_sync_queue') || '[]');
      existingQueue.push(fullItem);
      window.localStorage.setItem('ipds_sync_queue', JSON.stringify(existingQueue));
    } catch (_) {}

    return id;
  }

  /**
   * Retrieve all items in offline sync queue
   */
  public async getSyncQueue(): Promise<OfflineSyncQueueItem[]> {
    try {
      const db = await this.initDB();
      if (db) {
        return new Promise((resolve) => {
          const tx = db.transaction('sync_queue', 'readonly');
          const store = tx.objectStore('sync_queue');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      }
    } catch (_) {}

    try {
      return JSON.parse(window.localStorage.getItem('ipds_sync_queue') || '[]');
    } catch (_) {
      return [];
    }
  }

  /**
   * Remove processed item from sync queue
   */
  public async removeSyncQueueItem(id: string): Promise<void> {
    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('sync_queue', 'readwrite');
          const store = tx.objectStore('sync_queue');
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
        return;
      }
    } catch (_) {}

    try {
      const existingQueue: OfflineSyncQueueItem[] = JSON.parse(window.localStorage.getItem('ipds_sync_queue') || '[]');
      const filtered = existingQueue.filter(i => i.id !== id);
      window.localStorage.setItem('ipds_sync_queue', JSON.stringify(filtered));
    } catch (_) {}
  }
}

export const offlineStore = new OfflineStore();
