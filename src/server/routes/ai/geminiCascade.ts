import type { GoogleGenAI } from '@google/genai';
import { aiService } from '../../ai/index.js';

/**
 * Robust Multi-Model Cascade for Gemini generation with quota & rate limit resilience
 * Delegates to centralized aiService singleton for bounded timeouts, retries, and circuit breaking.
 */
export async function generateWithGeminiCascade(
  _ai?: GoogleGenAI | null,
  prompt: string = '',
  systemInstruction?: string,
  temperature: number = 0.1,
  maxOutputTokens: number = 8192
): Promise<string | null> {
  const result = await aiService.generateText({
    prompt,
    systemInstruction,
    temperature,
    maxOutputTokens,
    operationName: 'gemini_cascade'
  });
  return result.text;
}

