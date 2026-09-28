/**
 * iPDS 4.1 — Centralized AI Model & Timeout Configurations
 * All AI model lists, timeout limits, and reliability thresholds are managed here.
 */

export const AI_CONFIG = {
  models: {
    textCascade: [
      process.env.AI_MODEL_PRIMARY || 'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ],
    receiptOcr: [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ],
    pageOcr: [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ],
    weedVision: [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ],
    audioTranscription: [
      'gemini-2.5-flash',
      'gemini-3.8-flash'
    ],
    embedding: process.env.AI_MODEL_EMBEDDING || 'gemini-embedding-2-preview'
  },
  timeouts: {
    textCascadeMs: 45000,
    receiptOcrMs: 25000,
    weedVisionMs: 25000,
    pageOcrMs: 35000,
    audioMs: 25000,
    embeddingMs: 12000
  },
  circuitBreakers: {
    defaultCooldownMs: 30000,
    defaultFailureThreshold: 4
  }
} as const;
