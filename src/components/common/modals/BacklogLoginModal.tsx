import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ClipboardCheck, Info, Check, Calendar, HelpCircle, Layers } from "lucide-react";

interface BacklogLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BacklogLoginModal({ isOpen, onClose }: BacklogLoginModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative bg-white dark:bg-[#0f172a] rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden flex flex-col z-[170]"
          >
            {/* Elegant Header with Emerald Gradient */}
            <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <ClipboardCheck size={22} className="animate-bounce" />
                </div>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                    Ciri Baharu Backlog
                  </span>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide mt-1">
                    Modul Laporan Backlog
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 text-slate-600 dark:text-slate-300">
              <div className="space-y-2">
                <p className="text-xs leading-relaxed font-bold text-slate-700 dark:text-slate-200">
                  Selamat Datang! Sistem Laporan Backlog kini diaktifkan secara rasmi untuk memudahkan pemantauan buah sawit tertinggal di ladang.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Semua data diselaraskan secara automatik ke dalam pangkalan data Cloud Supabase untuk keselamatan tinggi.
                </p>
              </div>

              {/* Highlight Box - Critical Instruction requested by user */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Info size={16} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">Langkah Kemas Kini</span>
                </div>
                <p className="text-[11.5px] font-bold text-slate-800 dark:text-emerald-300 leading-relaxed">
                  💡 Staff boleh klik mana-mana baris Blok pada senarai laporan untuk memasukkan atau mengedit data backlog baharu.
                </p>
              </div>

              {/* Action Guides */}
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Buka tab <strong>Dashboard Hasil</strong> dan pilih submenu <strong>Laporan Backlog</strong>.
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    <strong>Klik mana-mana blok</strong> untuk membuka borang taktil kemasukan data.
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Masukkan bilangan tandan backlog harian. Sistem akan mengira berat Tan secara automatik berasaskan ABW semasa.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                onClick={onClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] uppercase font-black py-3 px-6 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Check size={14} /> Faham & Mulakan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
