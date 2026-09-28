import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, X, Sun, Moon, Database, CheckCircle2, AlertCircle, Activity, ChevronRight, RefreshCw } from "lucide-react";
import { updateSupabaseClient, isSupabaseReady } from "../../../services/supabaseClient";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onConfigSaved?: () => void;
  onOpenSystemHealth?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDarkMode,
  setIsDarkMode,
  onConfigSaved,
  onOpenSystemHealth,
}: SettingsModalProps) {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const storedUrl = localStorage.getItem("supabase_url") || (window as any).__SUPABASE_URL__ || "";
      const storedKey = localStorage.getItem("supabase_anon_key") || (window as any).__SUPABASE_ANON_KEY__ || "";
      setSupabaseUrl(storedUrl);
      setSupabaseAnonKey(storedKey);
      setIsConnected(isSupabaseReady() || !!storedUrl);
      setIsSaved(false);
      setTestResult(null);

      // Auto-populate active database configuration from server endpoint if not set
      fetch("/api/public-config")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.supabaseUrl && data?.supabaseAnonKey) {
            (window as any).__SUPABASE_URL__ = data.supabaseUrl;
            (window as any).__SUPABASE_ANON_KEY__ = data.supabaseAnonKey;
            setSupabaseUrl((prev) => prev || data.supabaseUrl);
            setSupabaseAnonKey((prev) => prev || data.supabaseAnonKey);
            setIsConnected(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const res = await fetch("/api/health");
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const json = await res.json();
        setTestResult({
          success: true,
          message: `Sambungan ke pangkalan data berjaya (${elapsed}ms). Status: ${json.ready ? "Aktif & Sedia" : "Sedia"}`,
          latencyMs: elapsed,
        });
        setIsConnected(true);
      } else {
        setTestResult({
          success: false,
          message: `Pelayan memulangkan ralat HTTP ${res.status}. Sila pastikan pangkalan data aktif.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gagal berhubung dengan pelayan: ${err.message || "Ralat rangkaian"}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) return;

    updateSupabaseClient(supabaseUrl.trim(), supabaseAnonKey.trim(), true);
    setIsSaved(true);
    setIsConnected(true);
    if (onConfigSaved) {
      onConfigSaved();
    }
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-[#0f172a] rounded-[32px] p-0 w-full max-w-md shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Settings size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-lg leading-tight">
                    Tetapan Aplikasi
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                    Konfigurasi & Pangkalan Data
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-2 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Database Connection Section */}
              <section className="bg-slate-50 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/70 dark:border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-emerald-500" />
                    <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Sambungan Supabase
                    </h4>
                  </div>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Bersambung
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} /> Belum Bersambung
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Masukkan Supabase Project URL dan Anon Key anda jika pembolehubah persekitaran belum dimuat:
                </p>

                <form onSubmit={handleSaveCredentials} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://xyzcompany.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                      Supabase Anon Key
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      {isSaved ? "✓ Berjaya Disimpan & Disambung" : "Simpan & Sambung Supabase"}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw size={13} className={isTesting ? "animate-spin text-emerald-500" : "text-slate-400"} />
                      <span>{isTesting ? "Sedang Menguji Sambungan..." : "Uji Sambungan Pangkalan Data"}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${
                        testResult.success
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold">{testResult.success ? "Sambungan Berjaya" : "Ralat Sambungan"}</p>
                        <p className="text-[10px] opacity-90 mt-0.5">{testResult.message}</p>
                      </div>
                    </div>
                  )}
                </form>
              </section>

              {/* System Health & Observability Section */}
              {onOpenSystemHealth && (
                <section>
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                    Kesihatan &amp; Prestasi Sistem
                  </h4>
                  <button
                    type="button"
                    onClick={onOpenSystemHealth}
                    className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center justify-between group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <span>System Health &amp; API Usage</span>
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Live
                          </span>
                        </h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Semak kuota token AI, kadar ralat, dan status provider
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </section>
              )}

              {/* Visual Preference Section */}
              <section>
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">
                  Paparan Visual
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${!isDarkMode ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-600" : "bg-slate-50 dark:bg-white/5 border-transparent text-slate-400"}`}
                  >
                    <Sun size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Cahaya
                    </span>
                  </button>
                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${isDarkMode ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400" : "bg-slate-50 dark:bg-white/5 border-transparent text-slate-400"}`}
                  >
                    <Moon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Gelap
                    </span>
                  </button>
                </div>
              </section>

              <div className="pt-2 text-center pb-4">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                  FPMSB TUNGGAL v4.1.0 • 2026
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
