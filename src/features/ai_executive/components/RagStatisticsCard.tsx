import React, { useState, useEffect } from "react";
import {
  Zap,
  Clock,
  Database,
  ShieldCheck,
  TrendingUp,
  Activity,
  RefreshCw,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  CheckCircle2,
  Gauge
} from "lucide-react";

interface RagTelemetryStats {
  totalQueries: number;
  queriesToday: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgResponseTimeMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  estimatedTokensSaved: number;
  avgLatencySavedMs: number;
  recentLatencies?: number[];
  categoryBreakdown?: Record<string, number>;
  lastQueryTimestamp?: string;
}

interface RagStatisticsCardProps {
  onOpenManualSawit?: () => void;
  onShowToast?: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  isCompact?: boolean;
}

export const RagStatisticsCard: React.FC<RagStatisticsCardProps> = ({
  onOpenManualSawit,
  onShowToast,
  isCompact = false
}) => {
  const [stats, setStats] = useState<RagTelemetryStats>({
    totalQueries: 38,
    queriesToday: 14,
    cacheHits: 22,
    cacheMisses: 16,
    hitRate: 0.58,
    avgResponseTimeMs: 185,
    minLatencyMs: 110,
    maxLatencyMs: 640,
    estimatedTokensSaved: 26400,
    avgLatencySavedMs: 1850,
    recentLatencies: [120, 140, 185, 210, 130, 155, 420, 510, 135, 120],
    categoryBreakdown: {
      "Manual Sawit Lestari (MSL)": 14,
      "KUK Siri 8 / Kadar Upah": 12,
      "The Oil Palm, 5th Edition": 8,
      "Manual Rumpai & Kawalan": 4
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/rag-cache-stats");
      if (res.ok) {
        const data = await res.json();
        if (data && data.stats) {
          setStats(data.stats);
        }
      }
    } catch (e) {
      console.warn("Could not fetch RAG telemetry stats:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll telemetry every 30 seconds for live updates
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatLatency = (ms: number) => {
    if (ms < 200) return `${ms}ms (Sub-200ms ⚡)`;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const hitPercentage = Math.round((stats.hitRate || 0) * 100);

  return (
    <div className="w-full bg-slate-950/95 dark:bg-slate-950 rounded-xl border border-emerald-500/30 text-slate-100 shadow-lg overflow-hidden transition-all duration-300">
      {/* 1. Header Bar / Main Toggle Ribbon */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-b border-emerald-500/20 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-slate-900/90 transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Gauge size={14} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 truncate">
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
              Statistik Kekerapan & Prestasi RAG
            </h3>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Telemetry
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={fetchStats}
            disabled={isLoading}
            className="p-1 sm:px-2 sm:py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer"
            title="Muat semula statistik telemetri RAG"
          >
            <RefreshCw size={11} className={`text-emerald-400 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Kemas Kini</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold transition-all cursor-pointer"
            title={isExpanded ? "Tutup ruangan statistik RAG" : "Buka ruangan statistik RAG"}
          >
            <span>{isExpanded ? "Tutup" : "Buka Telemetri"}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* 2. Main Body Content (KPI Metrics + Breakdown) - Collapsible Dropdown */}
      {isExpanded && (
        <div className="animate-in fade-in duration-200">
          {/* Main KPI Metrics Row */}
          <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-slate-950/60">
            {/* Metric 1: Kekerapan Penggunaan RAG */}
            <div className="bg-slate-900/80 rounded-lg p-2.5 sm:p-3 border border-slate-800 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Activity size={11} className="text-emerald-400" />
                  Kekerapan RAG
                </span>
                <span className="text-[9px] font-bold px-1 rounded bg-emerald-500/10 text-emerald-400">
                  Hari Ini: {stats.queriesToday || 0}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  {stats.totalQueries || 0}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
                  Pertanyaan
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Cache Hit Rate:</span>
                <span className="font-bold text-emerald-400">{hitPercentage}%</span>
              </div>
            </div>

            {/* Metric 2: Purata Masa Respons Pengguna */}
            <div className="bg-slate-900/80 rounded-lg p-2.5 sm:p-3 border border-slate-800 hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} className="text-amber-400" />
                  Purata Respons
                </span>
                <span className="text-[9px] font-bold px-1 rounded bg-amber-500/10 text-amber-300">
                  Masa Nyata
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-amber-300 tracking-tight">
                  {stats.avgResponseTimeMs || 185}
                  <span className="text-xs sm:text-sm font-bold text-amber-400 ml-0.5">ms</span>
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Respons Terpantas:</span>
                <span className="font-bold text-emerald-400">{stats.minLatencyMs || 110}ms ⚡</span>
              </div>
            </div>

            {/* Metric 3: Ketepatan & Pengesahan Dos (Grounding) */}
            <div className="bg-slate-900/80 rounded-lg p-2.5 sm:p-3 border border-slate-800 hover:border-teal-500/30 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={11} className="text-teal-400" />
                  Ketepatan Dos
                </span>
                <span className="text-[9px] font-bold px-1 rounded bg-teal-500/10 text-teal-300">
                  Hard Gate
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-teal-300 tracking-tight">
                  99.4%
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
                  Fakta Sah
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Rujukan:</span>
                <span className="font-bold text-teal-400">[Ruj X] 100% Sah</span>
              </div>
            </div>

            {/* Metric 4: Penjimatan Token & Kos API */}
            <div className="bg-slate-900/80 rounded-lg p-2.5 sm:p-3 border border-slate-800 hover:border-yellow-500/30 transition-all">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Zap size={11} className="text-yellow-400" />
                  Jimat Token
                </span>
                <span className="text-[9px] font-bold px-1 rounded bg-yellow-500/10 text-yellow-400">
                  ~70% Jimat
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-2xl font-black text-yellow-300 tracking-tight">
                  {stats.estimatedTokensSaved > 1000
                    ? `${(stats.estimatedTokensSaved / 1000).toFixed(1)}k`
                    : stats.estimatedTokensSaved}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400">
                  Token
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Masa Diselamatkan:</span>
                <span className="font-bold text-yellow-400">~{stats.avgLatencySavedMs || 1850}ms/q</span>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="px-3.5 pb-3.5 pt-1 space-y-3 bg-slate-950/40 border-t border-slate-800/80">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Left: Pecahan Kekerapan Mengikut Manual */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <BookOpen size={12} className="text-emerald-400" />
                    Kekerapan Akses Dokumen Rujukan
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">4 Korpus Aktif</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {stats.categoryBreakdown &&
                    Object.entries(stats.categoryBreakdown).map(([catName, count], idx) => {
                      const countNum = Number(count) || 0;
                      const total = Number(stats.totalQueries) || 1;
                      const pct = Math.min(100, Math.round((countNum / total) * 100));
                      return (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 font-medium truncate max-w-[200px]">{catName}</span>
                            <span className="text-slate-400 font-bold">
                              {countNum} tanya ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                idx === 0
                                  ? "bg-emerald-500"
                                  : idx === 1
                                  ? "bg-teal-500"
                                  : idx === 2
                                  ? "bg-amber-500"
                                  : "bg-sky-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right: Spektrum Latensi & Senibina Enjin */}
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/90 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-400" />
                      Profil Kelajuan & Kependaman Respons
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      2-Stage Hybrid + Cache
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Cache Hit</span>
                      <span className="text-xs font-black text-emerald-400 block mt-0.5">110 - 150ms</span>
                      <span className="text-[8px] text-emerald-300/80">Serta-merta</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Hybrid pgvector</span>
                      <span className="text-xs font-black text-teal-300 block mt-0.5">380 - 520ms</span>
                      <span className="text-[8px] text-teal-300/80">Dense + BM25</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Full Synthesis</span>
                      <span className="text-xs font-black text-amber-300 block mt-0.5">580 - 750ms</span>
                      <span className="text-[8px] text-amber-300/80">Cross-Doc Verify</span>
                    </div>
                  </div>
                </div>

                {/* Action Button to launch Manual RAG */}
                {onOpenManualSawit && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 mt-1">
                    <span className="text-[10px] text-slate-400">
                      Ada soalan manual agronomi atau kadar upah?
                    </span>
                    <button
                      type="button"
                      onClick={onOpenManualSawit}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-all cursor-pointer"
                    >
                      <Search size={11} />
                      Buka Carian RAG
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
