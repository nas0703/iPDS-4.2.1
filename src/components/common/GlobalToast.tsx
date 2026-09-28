import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, AlertCircle, X } from "lucide-react";

export interface ToastData {
  type: "success" | "error" | string;
  msg: string;
}

export interface GlobalToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function GlobalToast({ toast, onClose }: GlobalToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -25, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className={`fixed top-4 left-4 right-4 max-w-md md:max-w-lg mx-auto z-[99999] p-4 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-sm font-bold text-white border select-none ${
            toast.type === "success"
              ? "bg-emerald-600/95 border-emerald-400/60 shadow-[0_15px_30px_rgba(5,150,105,0.4)]"
              : "bg-rose-600/95 border-rose-400/60 shadow-[0_15px_30px_rgba(225,29,72,0.4)]"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                toast.type === "success"
                  ? "bg-emerald-700/80 text-emerald-100"
                  : "bg-rose-700/80 text-rose-100"
              }`}
            >
              {toast.type === "success" ? (
                <ShieldCheck size={22} className="animate-in zoom-in" />
              ) : (
                <AlertCircle size={22} className="animate-in zoom-in" />
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold leading-snug break-words">
              {toast.msg}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/80 hover:text-white transition-colors shrink-0 outline-none cursor-pointer"
            title="Tutup pemberitahuan"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
