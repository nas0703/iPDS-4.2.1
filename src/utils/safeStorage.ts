/**
 * Safe localStorage wrapper with memory fallback, type-safety, and try/catch guards.
 * Prevents DOMException / QuotaExceededError / private mode crashes from white-screening the app.
 */

class SafeStorage {
  private memoryFallback: Map<string, string> = new Map();

  public get(key: string, defaultValue: string = ''): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (err) {
      console.warn(`[SafeStorage] Failed to read key "${key}" from localStorage:`, err);
    }
    return this.memoryFallback.get(key) ?? defaultValue;
  }

  public set(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (err) {
      console.warn(`[SafeStorage] Failed to write key "${key}" to localStorage, using memory fallback:`, err);
    }
    this.memoryFallback.set(key, value);
    return false;
  }

  public getJSON<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[SafeStorage] Corrupt JSON in key "${key}", returning fallback:`, err);
      return fallback;
    }
  }

  public setJSON<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      return this.set(key, serialized);
    } catch (err) {
      console.warn(`[SafeStorage] Failed to serialize JSON for key "${key}":`, err);
      return false;
    }
  }

  public remove(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[SafeStorage] Failed to remove key "${key}":`, err);
    }
    this.memoryFallback.delete(key);
  }

  public clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (err) {
      console.warn(`[SafeStorage] Failed to clear localStorage:`, err);
    }
    this.memoryFallback.clear();
  }
}

export const safeStorage = new SafeStorage();
