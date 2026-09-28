import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, ShieldAlert, CheckCircle2, LogOut } from "lucide-react";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onExtend,
  onLogout,
}: SessionTimeoutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onExtend}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative bg-slate-900 border border-amber-500/40 w-full max-w-sm rounded-[32px] shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden p-6 text-center z-10"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Pulsing Icon */}
            <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping opacity-75" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-900/50">
                <Clock className="w-8 h-8 text-slate-950 animate-pulse" />
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider mb-3">
              <ShieldAlert size={14} />
              <span>Kunci Keselamatan Aktif</span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">
              Sesi Akan Ditamatkan
            </h3>

            {/* Description */}
            <p className="text-xs font-medium text-slate-300 mb-4 leading-relaxed">
              Tiada sentuhan atau aktiviti dikesan selama{" "}
              <span className="text-amber-400 font-bold">29 minit</span>. Untuk
              melindungi data operasi ladang, sesi akan dilog keluar dalam:
            </p>

            {/* Countdown Display */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl py-3 px-4 mb-6 flex items-center justify-center gap-2">
              <span className="font-mono text-3xl font-black text-amber-400 tracking-tight">
                {secondsRemaining}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-1">
                saat
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onExtend}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 size={18} />
                <span>Kekalkan Sesi Aktif</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 active:scale-[0.98] font-bold text-xs uppercase tracking-wider rounded-2xl border border-slate-700/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogOut size={16} />
                <span>Log Keluar Sekarang</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default SessionTimeoutModal;
