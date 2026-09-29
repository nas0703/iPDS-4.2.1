/**
 * Safe fetch utility with timeout control and automatic retry with exponential backoff.
 * Prevents hanging UI when mobile estate network connections are slow or drop packets.
 */

import { getActiveEstateId } from './estateContext';

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

export class FetchTimeoutError extends Error {
  constructor(message: string = 'Network request timed out') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 15000,
    retries = 2,
    backoffMs = 800,
    ...fetchOptions
  } = options;

  // Auto-inject x-estate-id and Authorization headers if not present
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('x-estate-id')) {
    const activeEstate = getActiveEstateId();
    if (activeEstate) {
      headers.set('x-estate-id', activeEstate);
    }
  }

  if (!headers.has('Authorization')) {
    try {
      const token = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ipds_token') : null) ||
                    (typeof localStorage !== 'undefined' ? localStorage.getItem('ipds_token') : null);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (e) {}
  }

  if (!headers.has('x-auth-role')) {
    try {
      const role = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ipds_auth_role') : null) ||
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('ipds_auth_role') : null);
      if (role) {
        headers.set('x-auth-role', role);
      }
    } catch (e) {}
  }

  fetchOptions.headers = headers;
  fetchOptions.credentials = fetchOptions.credentials || 'include';

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Return immediately on successful or standard HTTP status
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      const isAborted = err.name === 'AbortError' || controller.signal.aborted;
      if (isAborted) {
        lastError = new FetchTimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
      }

      // If attempts remain, wait with exponential backoff before retrying
      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch from ${url}`);
}

export async function safeFetchJSON<T>(url: string, options: SafeFetchOptions = {}, fallback: T): Promise<T> {
  try {
    const res = await safeFetch(url, options);
    if (!res.ok) {
      console.warn(`[safeFetchJSON] Non-2xx response from ${url}: ${res.status}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[safeFetchJSON] Error fetching JSON from ${url}:`, err);
    return fallback;
  }
}
