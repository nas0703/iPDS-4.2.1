/**
 * iPDS 4.1 — Centralized AI Service Wrapper
 * Encapsulates SDK client initialization, multi-model cascade, timeouts, retries,
 * circuit breakers, and metrics collection for all server-side AI operations.
 */

import { GoogleGenAI } from '@google/genai';
import { withRetry, withTimeout, getCircuitBreaker, classifyError } from '../reliability/index.js';
import { metricsCollector } from '../observability/metrics.js';
import { AI_CONFIG } from './aiConfig.js';
import { AiTextOptions, AiVisionOptions, AiEmbeddingOptions, AiTextResponse } from './types.js';

export class AiService {
  private client: GoogleGenAI | null = null;
  private lastErrors: Map<string, { category: string; message: string; timestamp: number }> = new Map();

  public getLastError(operationName: string): { category: string; message: string; timestamp: number } | null {
    return this.lastErrors.get(operationName) || null;
  }

  public getClient(): GoogleGenAI | null {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!this.client && key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    return this.client;
  }

  public isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    return !!key;
  }

  /**
   * 1. generateText: Unified multi-model text generation with cascade & circuit breaker
   */
  public async generateText(opts: AiTextOptions): Promise<AiTextResponse> {
    const ai = this.getClient();
    if (!ai) return { text: null };

    const startTime = Date.now();
    const candidateModels = opts.candidateModels || AI_CONFIG.models.textCascade;
    const timeoutMs = opts.timeoutMs || AI_CONFIG.timeouts.textCascadeMs;
    const breakerName = opts.circuitBreakerName || 'gemini-cascade';

    const breaker = getCircuitBreaker(breakerName, {
      failureThreshold: 4,
      cooldownMs: AI_CONFIG.circuitBreakers.defaultCooldownMs,
      onStateChange: (_from, to) => {
        if (to === 'OPEN') metricsCollector.recordReliabilityEvent('circuit_open');
      }
    });

    let attemptsCount = 0;

    for (const modelName of candidateModels) {
      const modelBreaker = getCircuitBreaker(`${breakerName}-${modelName}`, {
        failureThreshold: 3,
        cooldownMs: AI_CONFIG.circuitBreakers.defaultCooldownMs,
        onStateChange: (_from, to) => {
          if (to === 'OPEN') metricsCollector.recordReliabilityEvent('circuit_open');
        }
      });

      if (modelBreaker.getState() === 'OPEN') {
        console.warn(`[AiService] Circuit for ${modelName} is OPEN, skipping candidate`);
        continue;
      }

      try {
        attemptsCount++;
        const responseText = await modelBreaker.execute(() =>
          withTimeout(
            () =>
              withRetry(
                async () => {
                  const response = await ai.models.generateContent({
                    model: modelName,
                    contents: opts.prompt,
                    config: {
                      systemInstruction: opts.systemInstruction,
                      temperature: opts.temperature ?? 0.1,
                      maxOutputTokens: opts.maxOutputTokens ?? 8192,
                      topP: opts.topP
                    }
                  });
                  return response?.text?.trim() || null;
                },
                {
                  maxAttempts: opts.maxAttemptsPerModel ?? 2,
                  initialDelayMs: 600,
                  maxDelayMs: 2500,
                  onRetry: () => metricsCollector.recordReliabilityEvent('retry')
                }
              ),
            { timeoutMs, operationName: `${opts.operationName}_${modelName}` }
          )
        );

        if (responseText) {
          return {
            text: responseText,
            model: modelName,
            modelUsed: modelName,
            latencyMs: Date.now() - startTime,
            attempts: attemptsCount,
            attemptsCount
          };
        }
      } catch (err: any) {
        const classified = classifyError(err);
        if (classified.category === 'TIMEOUT') {
          metricsCollector.recordReliabilityEvent('timeout');
        }
        console.warn(`[AiService] ${opts.operationName} model ${modelName} failed (${classified.category}): ${classified.message}`);
      }
    }

    return {
      text: null,
      latencyMs: Date.now() - startTime,
      attempts: attemptsCount,
      attemptsCount
    };
  }

  /**
   * 2. extractVision: Unified multimodal extraction (Image/Audio inlineData)
   */
  public async extractVision(opts: AiVisionOptions): Promise<string | null> {
    const ai = this.getClient();
    if (!ai) return null;

    const candidateModels = opts.candidateModels || AI_CONFIG.models.receiptOcr;
    const timeoutMs = opts.timeoutMs || AI_CONFIG.timeouts.receiptOcrMs;
    const baseBreakerName = opts.circuitBreakerName || 'gemini-vision';

    for (const modelName of candidateModels) {
      const modelBreaker = getCircuitBreaker(`${baseBreakerName}-${modelName}`, {
        failureThreshold: opts.circuitBreakerFailureThreshold ?? 3,
        cooldownMs: AI_CONFIG.circuitBreakers.defaultCooldownMs,
        onStateChange: (_from, to) => {
          if (to === 'OPEN') metricsCollector.recordReliabilityEvent('circuit_open');
        }
      });

      if (modelBreaker.getState() === 'OPEN') {
        console.warn(`[AiService Vision] Circuit for ${modelName} is OPEN, skipping candidate`);
        continue;
      }

      try {
        const responseText = await modelBreaker.execute(() =>
          withTimeout(
            () =>
              withRetry(
                async () => {
                  const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                      {
                        inlineData: {
                          mimeType: opts.mimeType,
                          data: opts.base64Data
                        }
                      },
                      { text: opts.prompt }
                    ],
                    config: {
                      responseMimeType: opts.responseMimeType,
                      temperature: opts.temperature ?? 0.1,
                      maxOutputTokens: opts.maxOutputTokens ?? 2048
                    }
                  });
                  const directText = response?.text?.trim();
                  if (directText) return directText;
                  
                  // Safe fallback if parts are nested
                  const candidateParts = response?.candidates?.[0]?.content?.parts;
                  if (Array.isArray(candidateParts)) {
                    const merged = candidateParts.map((p: any) => p?.text || '').join('').trim();
                    if (merged) return merged;
                  }
                  return null;
                },
                {
                  maxAttempts: opts.maxAttemptsPerModel ?? 1,
                  initialDelayMs: opts.initialDelayMs ?? 600,
                  maxDelayMs: opts.maxDelayMs ?? 2000,
                  onRetry: () => metricsCollector.recordReliabilityEvent('retry')
                }
              ),
            { timeoutMs, operationName: `${opts.operationName}_${modelName}` }
          )
        );

        if (responseText && responseText.length > 3) {
          this.lastErrors.delete(opts.operationName);
          return responseText;
        }
      } catch (err: any) {
        const classified = classifyError(err);
        this.lastErrors.set(opts.operationName, {
          category: classified.category,
          message: classified.message,
          timestamp: Date.now()
        });
        if (classified.category === 'TIMEOUT') {
          metricsCollector.recordReliabilityEvent('timeout');
        }
        console.warn(`[AiService Vision] ${opts.operationName} fallback with ${modelName} (${classified.category}): ${classified.message}`);
      }
    }

    return null;
  }

  /**
   * 3. generateEmbedding: Unified vector embedding generation (768 dimensions)
   */
  public async generateEmbedding(
    optsOrText: AiEmbeddingOptions | string,
    taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'
  ): Promise<number[] | null> {
    const opts: AiEmbeddingOptions = typeof optsOrText === 'string'
      ? { text: optsOrText, taskType: taskType ?? 'RETRIEVAL_QUERY' }
      : optsOrText;

    if (process.env.NODE_ENV === 'test' || process.env.CI || !process.env.GEMINI_API_KEY || !this.isConfigured()) {
      return new Array(opts.outputDimensionality ?? 768).fill(0.001);
    }

    const ai = this.getClient();
    if (!ai) return null;

    const breaker = getCircuitBreaker('gemini-embedding', {
      failureThreshold: 5,
      cooldownMs: 20000,
      onStateChange: (_from, to) => {
        if (to === 'OPEN') metricsCollector.recordReliabilityEvent('circuit_open');
      }
    });

    try {
      const response = await breaker.execute(() =>
        withTimeout(
          () =>
            withRetry(
              () =>
                ai.models.embedContent({
                  model: AI_CONFIG.models.embedding,
                  contents: opts.text,
                  config: {
                    outputDimensionality: opts.outputDimensionality ?? 768,
                    taskType: opts.taskType ?? 'RETRIEVAL_QUERY'
                  }
                }),
              {
                maxAttempts: 2,
                initialDelayMs: 400,
                maxDelayMs: 2000,
                onRetry: () => metricsCollector.recordReliabilityEvent('retry')
              }
            ),
          { timeoutMs: opts.timeoutMs || AI_CONFIG.timeouts.embeddingMs, operationName: 'gemini_embed_content' }
        )
      );

      return (response as any).embeddings?.[0]?.values || (response as any).embedding?.values || null;
    } catch (error: any) {
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429')) {
        console.warn('[AiService Embedding] Quota reached (429), falling back seamlessly to Lexical/BM25.');
      } else {
        console.error('[AiService Embedding] Error:', error?.message || error);
      }
      return null;
    }
  }
}

export const aiService = new AiService();
