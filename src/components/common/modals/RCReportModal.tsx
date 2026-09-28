import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clipboard, Share2 } from 'lucide-react';

export const RCReportModal = ({
  isOpen,
  onClose,
  generateRCReport,
  handleCopyReport,
  handleWhatsAppShare,
}: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Laporan RC Daily
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
                    Regional Controller Format
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 font-mono text-[10px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
                {generateRCReport()}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyReport}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                >
                  <Clipboard
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                  <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">
                    Salin Teks
                  </span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleWhatsAppShare}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-500 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30"
                >
                  <Share2 size={20} className="text-white" />
                  <span className="text-[9px] font-black uppercase text-white">
                    WhatsApp
                  </span>
                </motion.button>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 py-3 bg-slate-900 dark:bg-slate-800 text-white/50 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-[0.98] transition-all hover:text-white"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
