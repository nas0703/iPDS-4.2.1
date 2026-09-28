/**
 * IPDS Estate Context Helper
 * Centralized utility to resolve and switch active authenticated estate_id
 * for all direct Supabase database operations, API requests, and UI dashboards.
 */

import { getEstateConfig, EstateConfig, canSwitchEstates, normalizeEstateId } from "../config/estateRegistry";

let runtimeEstateId: string | null = null;

export const ESTATE_CHANGED_EVENT = "ipds_active_estate_changed";

/**
 * Set active runtime estate ID and notify all subscribers across the application
 */
export function setRuntimeEstateId(estateId: string): void {
  if (estateId && typeof estateId === 'string') {
    const cleanId = estateId.trim().toUpperCase();
    runtimeEstateId = cleanId;

    if (typeof window !== 'undefined') {
      (window as any).__IPDS_ACTIVE_ESTATE_ID__ = cleanId;
      try {
        sessionStorage.setItem('ipds_active_estate_id', cleanId);
        localStorage.setItem('ipds_active_estate_id', cleanId);
      } catch (e) {
        // Ignore storage restrictions
      }

      // Always dispatch event to guarantee all active components update immediately
      window.dispatchEvent(new CustomEvent(ESTATE_CHANGED_EVENT, { detail: { estateId: cleanId } }));
    }
  }
}

/**
 * Get active runtime estate ID
 */
export function getActiveEstateId(): string {
  if (runtimeEstateId) return runtimeEstateId;

  if (typeof window !== 'undefined') {
    if ((window as any).__IPDS_ACTIVE_ESTATE_ID__) {
      return (window as any).__IPDS_ACTIVE_ESTATE_ID__;
    }
    try {
      const stored = sessionStorage.getItem('ipds_active_estate_id') || localStorage.getItem('ipds_active_estate_id');
      if (stored) return stored;
    } catch (e) {
      // Ignore storage restrictions
    }
  }

  // Fallback to configured environment default estate ID
  let envEstate: string | undefined = undefined;
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      envEstate = (import.meta as any).env.VITE_DEFAULT_ESTATE_ID;
    }
  } catch (_) {}

  if (!envEstate && typeof process !== 'undefined' && process.env) {
    envEstate = (process.env as any).VITE_DEFAULT_ESTATE_ID;
  }

  return envEstate || 'FPM_TUNGGAL';
}

/**
 * Get active estate full configuration
 */
export function getActiveEstateConfig(): EstateConfig {
  try {
    const currentId = getActiveEstateId();
    return getEstateConfig(currentId);
  } catch (err) {
    console.warn("Failed to getActiveEstateConfig, using fallback:", err);
    return getEstateConfig('FPM_TUNGGAL');
  }
}

/**
 * Infer or validate the exact Estate ID for a given transaction record.
 * Uses explicit estate_id field or explicit estate tags.
 */
export function inferEstateFromReceipt(record: any): string {
  if (!record) return 'FPM_TUNGGAL';

  const noResit = String(record.no_resit || '').trim().toUpperCase();
  const noAkaun = String(record.no_akaun_terima || '').trim().toUpperCase();
  const noNota = String(record.no_nota_hantaran || '').trim().toUpperCase();
  const kodPenjual = String(record.kod_penjual || '').trim().toUpperCase();
  const namaPenjual = String(record.nama_penjual || '').toUpperCase();
  const rawEstate = String(record.estate_id || '').trim().toUpperCase();
  const blok = String(record.blok || '').trim().toUpperCase();

  // 1. Strict metadata detection by delivery note (no_nota_hantaran), seller code, or receipt number
  // Tunggal: 155 / 5155
  if (
    noNota.startsWith('155') || 
    noNota.startsWith('5155') || 
    kodPenjual.startsWith('5155') || 
    kodPenjual.includes('5155') ||
    noResit.includes('TUNGGAL') || 
    noAkaun.includes('TUNGGAL') || 
    namaPenjual.includes('TUNGGAL') || 
    noResit.includes('TGL') ||
    noResit.startsWith('TGL-')
  ) {
    return 'FPM_TUNGGAL';
  }

  // Adela: 136 / 5136
  if (
    noNota.startsWith('136') || 
    noNota.startsWith('5136') || 
    kodPenjual.startsWith('5136') || 
    kodPenjual.includes('5136') ||
    noResit.includes('ADELA') || 
    noAkaun.includes('ADELA') || 
    namaPenjual.includes('ADELA') || 
    noResit.includes('ADL') ||
    noResit.startsWith('ADL-') ||
    ['1F', '2F', '125Y', '128Y', '121V'].includes(blok)
  ) {
    return 'FPM_ADELA';
  }

  // Kledang: 176 / 5176
  if (
    noNota.startsWith('176') || 
    noNota.startsWith('5176') || 
    kodPenjual.startsWith('5176') || 
    kodPenjual.includes('5176') ||
    noResit.includes('KLEDANG') || 
    noAkaun.includes('KLEDANG') || 
    namaPenjual.includes('KLEDANG') || 
    noResit.includes('KLD') ||
    noResit.startsWith('KLD-')
  ) {
    return 'FPM_KLEDANG';
  }

  // Sening: 156 / 5156
  if (
    noNota.startsWith('156') || 
    noNota.startsWith('5156') || 
    kodPenjual.startsWith('5156') || 
    kodPenjual.includes('5156') ||
    noResit.includes('SENING') || 
    noAkaun.includes('SENING') || 
    namaPenjual.includes('SENING') || 
    noResit.includes('SNG') ||
    noResit.startsWith('SNG-')
  ) {
    return 'FPM_SENING';
  }

  // 2. Fall back to explicit estate_id in record
  if (rawEstate) {
    if (rawEstate === 'FPM_ADELA' || rawEstate === 'ADELA' || rawEstate === 'ADL') return 'FPM_ADELA';
    if (rawEstate === 'FPM_KLEDANG' || rawEstate === 'KLEDANG' || rawEstate === 'KLD') return 'FPM_KLEDANG';
    if (rawEstate === 'FPM_SENING' || rawEstate === 'SENING' || rawEstate === 'SNG') return 'FPM_SENING';
    if (rawEstate === 'FPM_TUNGGAL' || rawEstate === 'TUNGGAL' || rawEstate === 'TGL') return 'FPM_TUNGGAL';
    return normalizeEstateId(rawEstate);
  }

  // 3. Try to normalize from receipt number, account or vendor name text if matching any known estate
  const combinedText = `${noResit} ${noAkaun} ${namaPenjual}`;
  const normalizedCandidate = normalizeEstateId(combinedText);
  if (normalizedCandidate && normalizedCandidate !== 'FPM_TUNGGAL') {
    return normalizedCandidate;
  }

  return 'FPM_TUNGGAL';
}
