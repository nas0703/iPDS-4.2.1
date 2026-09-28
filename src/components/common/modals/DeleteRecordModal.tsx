import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
  onDelete: (id: string) => void;
  isProcessing: boolean;
  type?: "single" | "all";
}

export function DeleteRecordModal({
  isOpen,
  onClose,
  recordId,
  onDelete,
  isProcessing,
  type = "single",
}: DeleteRecordModalProps) {
  const isAll = type === "all";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/10 p-6"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4">
                {isAll ? <AlertTriangle size={32} /> : <Trash2 size={32} />}
              </div>
              <h3 className={`text-lg font-display font-black uppercase tracking-widest mb-2 ${isAll ? "text-rose-600" : "text-slate-800 dark:text-white"}`}>
                {isAll ? "Padam Semua Data?" : "Padam Rekod?"}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">
                {isAll ? (
                  <>
                    Adakah anda pasti ingin memadam{" "}
                    <span className="text-rose-500 font-black">SEMUA</span> rekod
                    dalam pangkalan data? Tindakan ini adalah kekal dan tidak
                    boleh dibatalkan.
                  </>
                ) : (
                  <>
                    Adakah anda pasti ingin memadam rekod resit{" "}
                    {recordId && (
                      <span className="text-rose-500 font-black">
                        {recordId}
                      </span>
                    )}
                    ? Tindakan ini tidak boleh dibatalkan.
                  </>
                )}
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={onClose}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                     // Need to call onDelete safely, with empty string for "all" if recordId is null
                     onDelete(recordId || ""); 
                  }}
                  disabled={isProcessing}
                  className="bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    "Ya, Padam"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
