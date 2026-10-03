/**
 * IPDS System-Wide Version Configuration (Single Source of Truth)
 * Standardized across Web Frontend, Express Server, API Headers, Diagnostics & Supabase DB Contracts
 */

export const APP_VERSION = '4.2.1';
export const APP_VERSION_MAJOR = 4;
export const APP_VERSION_MINOR = 2;
export const APP_VERSION_PATCH = 1;
export const APP_VERSION_TAG = 'VER 4.2.1';
export const APP_NAME = 'iPDS - Integrated Plantation Data System';
export const APP_BUILD_NAME = 'iPDS Enterprise Multi-Tenant Engine';
export const APP_RELEASE_DATE = 'October 2026';
export const API_VERSION = 'v1';

export interface AppVersionInfo {
  version: string;
  versionTag: string;
  buildName: string;
  releaseDate: string;
  apiVersion: string;
  multiTenantStandard: string;
  rlsCoverage: string;
}

export function getVersionInfo(): AppVersionInfo {
  return {
    version: APP_VERSION,
    versionTag: APP_VERSION_TAG,
    buildName: APP_BUILD_NAME,
    releaseDate: APP_RELEASE_DATE,
    apiVersion: API_VERSION,
    multiTenantStandard: 'FPMSB Multi-Tenant Level 5',
    rlsCoverage: '100% Granular Multi-Domain RLS Matrix'
  };
}

export function getVersionHeaders(): Record<string, string> {
  return {
    'X-IPDS-Version': APP_VERSION,
    'X-IPDS-Release': APP_RELEASE_DATE,
    'X-IPDS-Standard': 'FPMSB-Level5'
  };
}
