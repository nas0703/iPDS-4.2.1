import { getSupabase } from '../db.js';

export interface RagReasoningStep {
  stepName: string;
  timestamp: string;
  durationMs?: number;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'SKIPPED';
  details: Record<string, any>;
}

export interface RagReasoningPath {
  queryAnalysis?: {
    rawQuery: string;
    normalizedTerms: string[];
    isTechnicalSpec: boolean;
    extractedKeywords: string[];
  };
  intentIsolation?: {
    detectedIntent: string;
    isSpecificWageQuery: boolean;
    filteredOutUnrelatedChunksCount: number;
    filteredOutCategories: string[];
    retainedCandidatesCount: number;
    retrievedSourcePages: Array<{ document: string; section: string; page: number }>;
  };
  retrievalStage?: {
    strategy: string;
    matchCount: number;
    rawCandidatesFound: number;
    topCandidateScores: Array<{
      id: string;
      title: string;
      section: string;
      page: number;
      vectorScore: number;
      keywordScore: number;
      finalScore: number;
    }>;
  };
  rerankingStage?: {
    algorithm: string;
    inputCandidatesCount: number;
    rerankedOutputCount: number;
    diversityScoreLambda?: number;
    selectedChunks: Array<{
      id: string;
      document: string;
      section: string;
      page: number;
    }>;
  };
  hardGateCheck?: {
    evaluated: boolean;
    triggered: boolean;
    reason?: string;
    isTopicSatisfied: boolean;
    evidenceCoverageScore: number;
    minThresholdRequired: number;
  };
  contextCompression?: {
    inputChunksCount: number;
    compressedEvidencesCount: number;
    estimatedTokensSaved?: number;
  };
  completenessStage?: {
    topicDomain: string;
    status: 'PASS' | 'EXPANDED_PASS' | 'INCOMPLETE_WARNING' | string;
    expectedEntities: string[];
    foundEntities: string[];
    missingEntities: string[];
    completenessRatio: number;
    diagnosticNote?: string;
  };
  generationStage?: {
    model: string;
    promptTokensEst?: number;
    attempts: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  };
  verificationReport?: {
    groundedStatus: 'GROUNDED' | 'UNGROUNDED' | 'PARTIAL' | 'NO_EVIDENCE' | 'AMBIGUOUS' | 'GROUNDING_FAILED' | 'NEEDS_REVIEW' | string;
    supportedClaimsCount: number;
    totalClaimsCount: number;
    citationCompleteness: number;
    numericalAccuracyRate: number;
    summary: string;
    isCriticalFailure: boolean;
  };
  diagnostics?: {
    rootCauseCategory?: 'NO_RELEVANT_CHUNKS' | 'LOW_SEMANTIC_SIMILARITY' | 'HARD_GATE_TRIPPED' | 'LLM_GENERATION_FAILED' | 'HALLUCINATION_DETECTED' | 'NUMERICAL_MISMATCH' | 'NONE';
    remedyRecommendation?: string;
  };
}

export interface RagPerformanceLogEntry {
  id?: string;
  created_at?: string;
  user_query: string;
  category_filter: string;
  user_id?: string;
  project_id?: string;
  execution_status: 'SUCCESS' | 'HARD_GATE_BLOCKED' | 'NO_EVIDENCE' | 'GENERATION_ERROR' | 'UNGROUNDED' | 'CACHED';
  is_grounded: boolean;
  hard_gate_triggered: boolean;
  failure_reason?: string | null;
  latency_ms: number;
  is_cached: boolean;
  final_confidence: number;
  evidence_coverage: number;
  retrieval_score: number;
  source_authority: number;
  numerical_accuracy_rate?: number;
  citations_count: number;
  citations: any[];
  reasoning_path: RagReasoningPath;
  response_preview?: string;
}

class RagLoggerService {
  private inMemoryLogs: RagPerformanceLogEntry[] = [];
  private maxInMemoryLogs = 200;

  /**
   * Log RAG execution outcome and reasoning path into Supabase (with in-memory fallback)
   */
  public async logExecution(entry: RagPerformanceLogEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const preparedEntry: RagPerformanceLogEntry = {
      ...entry,
      created_at: entry.created_at || timestamp,
      id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };

    // 1. Maintain in-memory circular buffer for ultra-fast local diagnostics
    this.inMemoryLogs.unshift(preparedEntry);
    if (this.inMemoryLogs.length > this.maxInMemoryLogs) {
      this.inMemoryLogs.pop();
    }

    // 2. Persist to Supabase asynchronously (Non-blocking)
    try {
      const supabase = getSupabase();
      if (!supabase) {
        return;
      }

      const dbPayload = {
        user_query: preparedEntry.user_query,
        category_filter: preparedEntry.category_filter || 'Semua',
        user_id: preparedEntry.user_id || null,
        project_id: preparedEntry.project_id || null,
        execution_status: preparedEntry.execution_status,
        is_grounded: preparedEntry.is_grounded,
        hard_gate_triggered: preparedEntry.hard_gate_triggered,
        failure_reason: preparedEntry.failure_reason || null,
        latency_ms: preparedEntry.latency_ms || 0,
        is_cached: preparedEntry.is_cached || false,
        final_confidence: preparedEntry.final_confidence || 0,
        evidence_coverage: preparedEntry.evidence_coverage || 0,
        retrieval_score: preparedEntry.retrieval_score || 0,
        source_authority: preparedEntry.source_authority || 0,
        numerical_accuracy_rate: preparedEntry.numerical_accuracy_rate ?? 100,
        citations_count: preparedEntry.citations_count || 0,
        citations: preparedEntry.citations || [],
        reasoning_path: preparedEntry.reasoning_path || {},
        response_preview: (preparedEntry.response_preview || '').substring(0, 1000)
      };

      // Fire and handle promise safely
      (async () => {
        try {
          const { error } = await supabase
            .from('rag_performance_logs')
            .insert(dbPayload);
          if (error) {
            console.warn('[RagLogger] Supabase log insert notice (fallback to in-memory):', error.message);
          }
        } catch (err: any) {
          console.warn('[RagLogger] Supabase async insert error:', err?.message || err);
        }
      })();
    } catch (err) {
      console.warn('[RagLogger] Exception dispatching log:', err);
    }
  }

  /**
   * Fetch recent RAG performance logs with optional status/search filters
   */
  public async getRecentLogs(options: {
    limit?: number;
    status?: string;
    searchQuery?: string;
    onlyFailures?: boolean;
  } = {}): Promise<{
    logs: RagPerformanceLogEntry[];
    source: 'supabase' | 'in-memory';
    stats: {
      total: number;
      successful: number;
      failed: number;
      hardGateBlocked: number;
      averageLatencyMs: number;
      cacheHitRate: number;
    };
  }> {
    const limit = options.limit || 50;
    const supabase = getSupabase();

    if (supabase) {
      try {
        let query = supabase
          .from('rag_performance_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (options.status && options.status !== 'all') {
          query = query.eq('execution_status', options.status);
        }

        if (options.onlyFailures) {
          query = query.neq('execution_status', 'SUCCESS');
        }

        if (options.searchQuery) {
          query = query.ilike('user_query', `%${options.searchQuery}%`);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return {
            logs: data,
            source: 'supabase',
            stats: this.computeStats(data)
          };
        }
      } catch (err) {
        console.warn('[RagLogger] Supabase query notice, using in-memory logs:', err);
      }
    }

    // Fallback to in-memory logs
    let filtered = [...this.inMemoryLogs];
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter(l => l.execution_status === options.status);
    }
    if (options.onlyFailures) {
      filtered = filtered.filter(l => l.execution_status !== 'SUCCESS');
    }
    if (options.searchQuery) {
      const q = options.searchQuery.toLowerCase();
      filtered = filtered.filter(l => l.user_query.toLowerCase().includes(q));
    }

    const sliced = filtered.slice(0, limit);
    return {
      logs: sliced,
      source: 'in-memory',
      stats: this.computeStats(this.inMemoryLogs)
    };
  }

  /**
   * Get single log by ID with complete reasoning path
   */
  public async getLogById(id: string): Promise<RagPerformanceLogEntry | null> {
    const inMem = this.inMemoryLogs.find(l => l.id === id);
    if (inMem) return inMem;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rag_performance_logs')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[RagLogger] Fetch single log error:', err);
      }
    }
    return null;
  }

  /**
   * Clear in-memory logs
   */
  public clearInMemoryLogs(): void {
    this.inMemoryLogs = [];
  }

  private computeStats(logs: RagPerformanceLogEntry[]) {
    const total = logs.length;
    if (total === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        hardGateBlocked: 0,
        averageLatencyMs: 0,
        cacheHitRate: 0
      };
    }

    const successful = logs.filter(l => l.execution_status === 'SUCCESS').length;
    const hardGateBlocked = logs.filter(l => l.hard_gate_triggered || l.execution_status === 'HARD_GATE_BLOCKED').length;
    const failed = total - successful;
    const cachedCount = logs.filter(l => l.is_cached).length;
    const totalLatency = logs.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0);

    return {
      total,
      successful,
      failed,
      hardGateBlocked,
      averageLatencyMs: Math.round(totalLatency / total),
      cacheHitRate: Number(((cachedCount / total) * 100).toFixed(1))
    };
  }
}

export const ragLogger = new RagLoggerService();
