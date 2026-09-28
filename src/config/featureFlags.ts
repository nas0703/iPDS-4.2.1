/**
 * Feature Flags Configuration
 * Allows toggling features safely to protect users from unreleased or unfinished modules.
 */

export interface FeatureFlags {
  enableAiExecutive: boolean;
  enableMorningBriefing: boolean;
  enableManualSawitRAG: boolean;
  enableWeedVision: boolean;
  enableAdvancedAnalytics: boolean;
  enableVoicePlayback: boolean;
  enableRCReportExport: boolean;
  enableSpeechAcronymCustomizer: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableAiExecutive: true,
  enableMorningBriefing: true,
  enableManualSawitRAG: true,
  enableWeedVision: true,
  enableAdvancedAnalytics: true,
  enableVoicePlayback: true,
  enableRCReportExport: true,
  enableSpeechAcronymCustomizer: true,
};

import { safeStorage } from '../utils/safeStorage';

const FEATURE_FLAGS_STORAGE_KEY = 'fpmsb_feature_flags_v1';

export function getFeatureFlags(): FeatureFlags {
  const saved = safeStorage.getJSON<Partial<FeatureFlags>>(FEATURE_FLAGS_STORAGE_KEY, {});
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...saved,
  };
}

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return Boolean(flags[feature]);
}

export function setFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void {
  const current = getFeatureFlags();
  const updated = {
    ...current,
    [feature]: enabled,
  };
  safeStorage.setJSON(FEATURE_FLAGS_STORAGE_KEY, updated);
}
