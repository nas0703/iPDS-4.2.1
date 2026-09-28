/**
 * iPDS 4.1 — AI Service Abstraction Layer Types
 * Strict typing for centralized AI operations: Text Cascade, Multimodal Vision, and Embeddings.
 */

export interface AiTextOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  candidateModels?: readonly string[] | string[];
  operationName: string;
  circuitBreakerName?: string;
  circuitBreakerFailureThreshold?: number;
  timeoutMs?: number;
  maxAttemptsPerModel?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface AiVisionOptions {
  prompt: string;
  base64Data: string;
  mimeType: string;
  responseMimeType?: 'application/json' | 'text/plain';
  temperature?: number;
  maxOutputTokens?: number;
  candidateModels?: readonly string[] | string[];
  operationName: string;
  circuitBreakerName?: string;
  circuitBreakerFailureThreshold?: number;
  timeoutMs?: number;
  maxAttemptsPerModel?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface AiEmbeddingOptions {
  text: string;
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
  outputDimensionality?: number;
  timeoutMs?: number;
}

export interface AiTextResponse {
  text: string | null;
  model?: string;
  modelUsed?: string;
  latencyMs?: number;
  attempts?: number;
  attemptsCount?: number;
}
