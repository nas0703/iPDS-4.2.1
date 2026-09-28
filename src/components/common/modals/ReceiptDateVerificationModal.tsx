import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, AlertTriangle, CheckCircle2, Clock, 
  RotateCcw, ArrowRight, ShieldAlert, Sparkles, FileText,
  Truck, Layers, Scale, X, Save
} from 'lucide-react';
import { 
  getTodayDateString, 
  normalizeDateToISO, 
  getDaysDifferenceFromToday, 
  formatDateWithDay,
  formatDate
} from '../../../utils/formatters';

export interface ExtractedReceiptInfo {
  no_resit?: string;
  no_lori?: string;
  no_nota_hantaran?: string;
  tan?: number | string;
  kpg?: number | string;
  muda?: number | string;
  blok?: string;
  rm_mt?: number | string;
  is_efb?: boolean;
  detected_estate_name?: string;
  detected_estate_id?: string;
  kod_penjual?: string;
  nama_penjual?: string;
  confidence?: number;
  [key: string]: any;
}

interface ReceiptDateVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedDate: string;
  receiptInfo: ExtractedReceiptInfo | null;
  onConfirmAndFillForm: (confirmedDate: string) => void;
  onConfirmAndSaveDirectly?: (confirmedDate: string) => void;
  isDarkMode?: boolean;
}

export const ReceiptDateVerificationModal: React.FC<ReceiptDateVerificationModalProps> = ({
  isOpen,
  onClose,
  detectedDate,
  receiptInfo,
  onConfirmAndFillForm,
  onConfirmAndSaveDirectly,
  isDarkMode = true,
}) => {
  const todayDate = getTodayDateString();
  const normalizedDetected = normalizeDateToISO(detectedDate);
  
  // State tarikh yang dipilih / dibetulkan oleh kerani
  const [selectedDate, setSelectedDate] = useState<string>(normalizedDetected || todayDate);

  // Semalam (Yesterday)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = normalizeDateToISO(yesterday.toISOString().split('T')[0]);

  // Update selectedDate whenever detectedDate changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(normalizedDetected || todayDate);
    }
  }, [isOpen, detectedDate, normalizedDetected, todayDate]);

  if (!isOpen) return null;

  const diffDaysDetected = getDaysDifferenceFromToday(normalizedDetected);
  const diffDaysSelected = getDaysDifferenceFromToday(selectedDate);
  
  const isFutureDate = diffDaysDetected > 0;
  const isPastDate = diffDaysDetected < 0;
  const absDiffDetected = Math.abs(diffDaysDetected);

  const isSelectedFuture = diffDaysSelected > 0;
  const isSelectedPast = diffDaysSelected < 0;
  const absDiffSelected = Math.abs(diffDaysSelected);

  const handleConfirmForm = () => {
    onConfirmAndFillForm(selectedDate);
  };

  const handleConfirmSave = () => {
    if (onConfirmAndSaveDirectly) {
      onConfirmAndSaveDirectly(selectedDate);
    } else {
      onConfirmAndFillForm(selectedDate);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Dialog Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden my-auto ${
            isDarkMode 
              ? "bg-slate-900 border-amber-500/30 text-white shadow-amber-950/40" 
              : "bg-white border-amber-200 text-slate-900 shadow-slate-300"
          }`}
        >
          {/* Top Accent Strip */}
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

          {/* Header */}
          <div className="p-4 sm:p-6 pb-2 sm:pb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                <AlertTriangle size={26} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Tapisan Keselamatan Tarikh
                  </span>
                  {receiptInfo?.confidence && (
                    <span className="text-[9px] font-mono font-bold text-slate-400">
                      OCR: {receiptInfo.confidence}%
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight mt-1">
                  Pengesahan Tarikh Resit Diimbas
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
              }`}
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-4 sm:p-6 pt-2 space-y-4">
            {/* Warning Reason Card */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border ${
              isFutureDate
                ? (isDarkMode ? "bg-rose-950/40 border-rose-500/40 text-rose-200" : "bg-rose-50 border-rose-200 text-rose-900")
                : (isDarkMode ? "bg-amber-950/40 border-amber-500/40 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900")
            }`}>
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={20} className={`shrink-0 mt-0.5 ${isFutureDate ? "text-rose-400" : "text-amber-400"}`} />
                <div className="text-xs space-y-1">
                  <p className="font-black text-sm">
                    {isFutureDate ? "Amaran: Tarikh Resit di Masa Hadapan!" : "Peringatan: Tarikh Resit Bukan Tarikh Semasa"}
                  </p>
                  <p className="leading-relaxed opacity-90">
                    {isFutureDate ? (
                      <>
                        AI OCR mengesan tarikh <strong className="underline">{formatDateWithDay(normalizedDetected)}</strong> iaitu <strong>{absDiffDetected} hari di hadapan</strong> tarikh hari ini. Sila semak sama ada tahun atau hari pada resit tersilap baca.
                      </>
                    ) : (
                      <>
                        AI OCR mengesan tarikh <strong className="underline">{formatDateWithDay(normalizedDetected)}</strong> ({absDiffDetected === 1 ? 'semalam' : `${absDiffDetected} hari yang lalu`}). Sila sahkan sama ada ini resit tertunggak atau perbetulkan kepada tarikh hari ini.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Side-by-Side */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* Tarikh Dikesan (OCR) */}
              <div className={`p-3 rounded-2xl border ${
                isDarkMode ? "bg-slate-800/80 border-slate-700" : "bg-slate-50 border-slate-200"
              }`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tarikh Dikesan (Resit)
                </span>
                <p className="text-xs sm:text-sm font-black font-mono text-amber-400 break-words">
                  {normalizedDetected || '-'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatDate(normalizedDetected, 'full')}
                </p>
              </div>

              {/* Tarikh Semasa (Hari Ini) */}
              <div className={`p-3 rounded-2xl border ${
                isDarkMode ? "bg-emerald-950/30 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"
              }`}>
                <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Clock size={11} /> Tarikh Semasa (Hari Ini)
                </span>
                <p className="text-xs sm:text-sm font-black font-mono text-emerald-600 dark:text-emerald-300 break-words">
                  {todayDate}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatDate(todayDate, 'full')}
                </p>
              </div>
            </div>

            {/* Quick Fix Button Controls */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Pilih / Tetapkan Tarikh Yang Betul:</span>
                {diffDaysSelected === 0 ? (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Hari Ini
                  </span>
                ) : isSelectedFuture ? (
                  <span className="text-rose-400 text-[10px] font-bold">
                    +{absDiffSelected} hari ke hadapan
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-bold">
                    -{absDiffSelected} hari lepas
                  </span>
                )}
              </label>

              {/* Quick Action Pills */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayDate)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95 ${
                    selectedDate === todayDate
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400"
                      : isDarkMode 
                        ? "bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700" 
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  <Calendar size={13} />
                  Gunakan Hari Ini ({todayDate})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayDate)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95 ${
                    selectedDate === yesterdayDate
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400"
                      : isDarkMode 
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" 
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                >
                  <Clock size={13} />
                  Semalam ({yesterdayDate})
                </button>

                {normalizedDetected && normalizedDetected !== todayDate && normalizedDetected !== yesterdayDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(normalizedDetected)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95 ${
                      selectedDate === normalizedDetected
                        ? "bg-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400"
                        : isDarkMode 
                          ? "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700" 
                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    <RotateCcw size={13} />
                    Kekalkan Resit ({normalizedDetected})
                  </button>
                )}
              </div>

              {/* Interactive Date Input for Custom Selection */}
              <div className="relative mt-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value || todayDate)}
                  className={`w-full text-xs font-bold rounded-xl px-4 py-3 border shadow-inner focus:outline-none focus:ring-2 transition-all ${
                    isDarkMode
                      ? "bg-slate-950 border-slate-700 text-white focus:ring-emerald-500 focus:border-emerald-500"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:ring-emerald-500 focus:border-emerald-500"
                  }`}
                />
                <span className={`absolute -top-2 left-3 px-1 text-[9px] font-black uppercase tracking-wider rounded ${
                  isDarkMode ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500"
                }`}>
                  Ubah Tarikh Secara Manual
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 italic">
                Tarikh yang dipilih: <span className="font-bold text-emerald-400 not-italic">{formatDateWithDay(selectedDate)}</span>
              </p>
            </div>

            {/* Extracted Slip Context Card */}
            {receiptInfo && (
              <div className={`p-3 rounded-2xl border text-xs ${
                isDarkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={12} /> Butiran Resit Diimbas
                  </span>
                  {receiptInfo.detected_estate_name && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {receiptInfo.detected_estate_name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">No. Resit:</span>
                    <span className={`font-mono font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{receiptInfo.no_resit || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">No. Lori:</span>
                    <span className={`font-mono font-bold text-xs ${isDarkMode ? "text-white" : "text-slate-900"}`}>{receiptInfo.no_lori || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Blok:</span>
                    <span className="font-bold text-emerald-500 dark:text-emerald-400 text-xs">{receiptInfo.blok || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block">Berat (MT):</span>
                    <span className="font-bold text-amber-500 dark:text-amber-400 text-xs">{receiptInfo.tan ? `${receiptInfo.tan} MT` : '-'}</span>
                  </div>
                  {receiptInfo.no_akuan_terima && (
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">No. Akuan Terima:</span>
                      <span className="font-mono font-bold text-blue-500 dark:text-blue-400 text-xs">{receiptInfo.no_akuan_terima}</span>
                    </div>
                  )}
                  {receiptInfo.kpg && (
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Kadar KPG:</span>
                      <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400 text-xs">{receiptInfo.kpg}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleConfirmForm}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-[0.98] transition-all"
                >
                  <ArrowRight size={15} />
                  <span>Sahkan & Masukkan ke Borang</span>
                </button>

                {onConfirmAndSaveDirectly && (
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 cursor-pointer touch-manipulation active:scale-[0.98] transition-all"
                  >
                    <Save size={15} />
                    <span>Sahkan & Terus Simpan</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 ${
                  isDarkMode 
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                Batal & Abaikan Imbasan
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
