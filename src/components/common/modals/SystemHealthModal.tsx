import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  X,
  RefreshCw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BarChart3,
  Server,
  ExternalLink,
  Layers
} from "lucide-react";
import { safeFetch } from "../../../utils/safeFetch";

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export function SystemHealthModal({ isOpen, onClose }: SystemHealthModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await safeFetch("/api/telemetry/system-health");
      if (!res.ok) {
        throw new Error(`Ralat HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.warn("[SystemHealthModal] Gagal memuatkan status:", err);
      setError(err?.message || "Gagal memuatkan data kesihatan sistem");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSystemHealth();
    }
  }, [isOpen, fetchSystemHealth]);

  if (!isOpen) return null;

  const provider = data?.provider || {
    name: "Google Gemini AI Studio API",
    tier: "Pay-As-You-Go / Billing Active",
    monthlyQuotaTokens: 1000000,
    estimatedTokensUsed: 0,
    usagePercentage: 0,
    isApproachingLimit: false,
    isQuotaExceeded: false,
  };

  const summary = data?.summary || {
    totalAiRequests: 0,
    totalAiErrors: 0,
    totalApiRequests: 0,
    totalApiErrors: 0,
    overallErrorRate: 0,
    rateLimitHits: 0,
    systemStatus: "HEALTHY",
  };

  const aiBreakdown = data?.aiBreakdown || [];
  const circuitBreakers = data?.circuitBreakers || [
    { name: "gemini-receipt-ocr", state: "CLOSED", label: "OCR Imbasan Resit" },
    { name: "gemini-weed-vision", state: "CLOSED", label: "Diagnosis WeedVision" },
    { name: "gemini-cascade", state: "CLOSED", label: "Modul Bualan Exec & RAG" },
    { name: "database-pool", state: "CLOSED", label: "Pangkalan Data (Supabase)" },
  ];

  // Usage percentage gauge color
  const usagePct = provider.usagePercentage || 0;
  let gaugeColor = "bg-emerald-500";
  let textColor = "text-emerald-500";
  let statusBadge = "STABIL";
  let statusBadgeBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";

  if (usagePct >= 95 || provider.isQuotaExceeded) {
    gaugeColor = "bg-rose-500";
    textColor = "text-rose-500";
    statusBadge = "HAD CRITICAL";
    statusBadgeBg = "bg-rose-500/10 text-rose-500 border-rose-500/20";
  } else if (usagePct >= 80 || provider.isApproachingLimit) {
    gaugeColor = "bg-amber-500";
    textColor = "text-amber-500";
    statusBadge = "AMARAN HAD";
    statusBadgeBg = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white dark:bg-[#0f172a] rounded-[32px] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <Activity size={22} className="text-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-800 dark:text-white text-lg leading-tight">
                    System Health & API Usage
                  </h3>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
                    {statusBadge}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  Pemantauan Token Provider AI & Kadar Ralat
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchSystemHealth}
                disabled={loading}
                title="Kemaskini Data"
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? "animate-spin text-emerald-500" : ""} />
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex items-center gap-3">
                <AlertTriangle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Provider Monthly Usage Progress Gauge */}
            <section className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu size={18} className="text-emerald-500" />
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Penggunaan Token AI Bulanan ({provider.name})
                    </h4>
                    <p className="text-[10px] font-medium text-slate-400">
                      Pelan: <span className="font-bold text-slate-700 dark:text-slate-300">{provider.tier}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-base font-black ${textColor}`}>
                    {usagePct}%
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Anggaran Digunakan
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(2, usagePct))}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${gaugeColor}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                  <span>{(provider.estimatedTokensUsed || 0).toLocaleString()} tokens</span>
                  <span>Had Bulanan: {(provider.monthlyQuotaTokens || 1000000).toLocaleString()} tokens</span>
                </div>
              </div>

              {/* Notice if approaching limit */}
              {usagePct >= 80 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Aplikasi Menghampiri Had Kuota Provider</p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      Penggunaan token semasa ({usagePct}%) telah melepasi amaran 80%. Sila semak konsol Google AI Studio untuk memastikan pengurusan billing aktif bagi mengelakkan ralat 429.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Top Operational Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">Jumlah AI Calls</span>
                  <Zap size={14} className="text-emerald-500" />
                </div>
                <p className="text-lg font-black text-slate-800 dark:text-white font-mono">
                  {summary.totalAiRequests || 0}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Operasi OCR &amp; RAG</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">Kadar Kejayaan</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <p className="text-lg font-black text-emerald-500 font-mono">
                  {summary.totalApiRequests > 0
                    ? `${(100 - (summary.overallErrorRate || 0)).toFixed(1)}%`
                    : "100%"}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Uptime &amp; Failsafe OK</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">Kadar Ralat (Error)</span>
                  <AlertTriangle size={14} className="text-amber-500" />
                </div>
                <p className="text-lg font-black text-amber-500 font-mono">
                  {summary.overallErrorRate}%
                </p>
                <p className="text-[9px] text-slate-400 font-medium">{summary.totalApiErrors || 0} Ralat Direkod</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">Rate Limit Hits</span>
                  <ShieldCheck size={14} className="text-blue-500" />
                </div>
                <p className="text-lg font-black text-slate-800 dark:text-white font-mono">
                  {summary.rateLimitHits || 0}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">HTTP 429 Throttled</p>
              </div>
            </div>

            {/* AI Operations Token Breakdown Table */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-500" />
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Pecahan Operasi AI &amp; Anggaran Token
                  </h4>
                </div>
              </div>

              {aiBreakdown.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-slate-400 text-xs">
                  Tiada rekod panggilan AI lagi dalam sesi ini.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/70 dark:border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 dark:bg-white/[0.03] text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-200/60 dark:border-white/5">
                        <tr>
                          <th className="p-3">Modul / Operasi</th>
                          <th className="p-3 text-center">Requests</th>
                          <th className="p-3 text-center">Kejayaan</th>
                          <th className="p-3 text-right">Est. Token</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono text-[11px]">
                        {aiBreakdown.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.01]">
                            <td className="p-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                              {item.operation}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                              {item.requests}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                {item.success}/{item.requests}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {(item.totalEstimatedTokens || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Subsystem Circuit Breakers */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-500" />
                <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                  Status Circuit Breakers &amp; Subsistem
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {circuitBreakers.map((cb: any, idx: number) => {
                  const isOpen = cb.state === "OPEN";
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <Server size={16} className={isOpen ? "text-rose-500" : "text-emerald-500"} />
                        <div>
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {cb.label}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">{cb.name}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isOpen
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isOpen ? "TERBUTA / HEATED" : "NORMAL"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Provider Upgrade / Status Link */}
            <div className="pt-2">
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Urus Kuota &amp; Billing di Google AI Studio</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
