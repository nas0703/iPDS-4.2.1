import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, DownloadCloud, LayoutDashboard, Percent, Trophy, CloudUpload, Scissors, Camera } from "lucide-react";

interface NewFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentUpdates: {
    version: string;
    date: string;
    items: {
      title: string;
      desc: string;
      icon: React.ReactNode;
      iconBg?: string;
    }[];
  }[];
}

export function NewFeaturesModal({
  isOpen,
  onClose,
  recentUpdates,
}: NewFeaturesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
            className="relative bg-white dark:bg-[#0f172a] rounded-[40px] p-8 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Ciri Baharu
                </h2>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1">
                  Kemas Kini {recentUpdates[0]?.date || "Terkini"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 p-2 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-8 custom-scrollbar overflow-y-auto max-h-[500px] pr-2">
              {recentUpdates[0]?.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 rounded-[24px] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.02]"
                >
                  <div
                    className={`w-12 h-12 ${item.iconBg || "bg-slate-100 dark:bg-slate-700"} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-slate-900 dark:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-500/10 active:scale-95 transition-all text-[11px]"
            >
              Faham & Teruskan
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
