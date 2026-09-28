import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Scan, Sparkles, Loader2, Check, Cpu, CheckCircle2, Clock } from "lucide-react";

interface OcrScanningOverlayProps {
  isScanning: boolean;
  onCancel?: () => void;
}

interface StepItem {
  id: number;
  shortTitle: string;
  label: string;
  sub: string;
  progressPercent: number;
}

const OCR_STEPS: StepItem[] = [
  {
    id: 1,
    shortTitle: "Pra-Pemprosesan Imej",
    label: "Membaca & Menala Imej Tiket",
    sub: "Mempertingkatkan kontras, pencahayaan & ketajaman teks",
    progressPercent: 25,
  },
  {
    id: 2,
    shortTitle: "Pengecaman Gemini AI",
    label: "Pengecaman Pengecam Visi AI",
    sub: "Mengecam No. Akuan Terima, No. Resit Kilang & No. Lori",
    progressPercent: 55,
  },
  {
    id: 3,
    shortTitle: "Ekstraksi Data Metrik",
    label: "Mengekstrak Berat & Blok Sawit",
    sub: "Mengira Berat Bersih (MT), Kadar KPG%, Blok/PKT & Mutu",
    progressPercent: 80,
  },
  {
    id: 4,
    shortTitle: "Penentusahan & Semakan",
    label: "Semakan Anti-Pertindihan & Registry",
    sub: "Menentusahkan rekod ladang dan menghalang pertindihan resit",
    progressPercent: 95,
  },
];

export const OcrScanningOverlay: React.FC<OcrScanningOverlayProps> = ({ isScanning }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    if (!isScanning) {
      setStepIndex(0);
      setSecondsRemaining(3);
      return;
    }

    setStepIndex(0);
    setSecondsRemaining(3);

    // Timeline berdurasi tepat 3 saat (3000ms):
    // 0.0s - 0.75s : Langkah 1 (Pra-Pemprosesan Imej) - 25% (3s baki)
    // 0.75s - 1.50s: Langkah 2 (Pengecaman Gemini AI) - 55% (2s baki)
    // 1.50s - 2.25s: Langkah 3 (Ekstraksi Data Metrik) - 80% (2s / 1s baki)
    // 2.25s - 2.90s: Langkah 4 (Penentusahan & Semakan) - 95% (1s baki)
    // 2.90s - 3.20s: Langkah 5 (Semua Selesai / 100%) - 100% (0s baki)

    const timer1 = setTimeout(() => {
      setStepIndex(1);
      setSecondsRemaining(2);
    }, 750);

    const timer2 = setTimeout(() => {
      setStepIndex(2);
    }, 1500);

    const timer3 = setTimeout(() => {
      setStepIndex(3);
      setSecondsRemaining(1);
    }, 2250);

    const timer4 = setTimeout(() => {
      setStepIndex(4); // Fasa 100% selesai
      setSecondsRemaining(0);
    }, 2900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isScanning]);

  if (!isScanning) return null;

  const isAllComplete = stepIndex >= 4;
  const currentStep = isAllComplete
    ? {
        id: 5,
        shortTitle: "Imbasan Selesai",
        label: "Data Berjaya Diekstrak!",
        sub: "Maklumat resit telah siap diproses & sedia untuk disimpan.",
        progressPercent: 100,
      }
    : OCR_STEPS[stepIndex] || OCR_STEPS[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-[360px] sm:max-w-[370px] overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-4 sm:p-5 text-left shadow-2xl shadow-emerald-950/70 ring-1 ring-emerald-400/20 backdrop-blur-xl"
        >
          {/* Ambient Glow Effect */}
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-32 bg-emerald-500/15 rounded-full blur-3xl" />

          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isAllComplete ? 'bg-emerald-400' : 'bg-cyan-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAllComplete ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
              </span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400 uppercase flex items-center gap-1.5">
                <Cpu size={12} className="text-emerald-400" />
                <span>AI OCR Pipeline</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* 3s Countdown Badge */}
              <div className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1">
                <Clock size={10} className="text-emerald-400" />
                <span>{secondsRemaining > 0 ? `${secondsRemaining}s` : "Siap"}</span>
              </div>

              {/* Step Counter Badge */}
              <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold transition-colors ${
                isAllComplete
                  ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-300"
                  : "bg-emerald-950/80 border-emerald-500/30 text-emerald-300"
              }`}>
                {isAllComplete ? "Selesai 4/4" : `Proses ${stepIndex + 1}/4`}
              </div>
            </div>
          </div>

          {/* Main Visual & Active Headline Row */}
          <div className="mt-3.5 flex items-center gap-3.5">
            {/* Holographic Scanner Visual Box */}
            <div className={`relative shrink-0 flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-black border transition-all duration-300 ${
              isAllComplete
                ? "border-emerald-400 shadow-lg shadow-emerald-500/20"
                : "border-emerald-500/40 shadow-inner shadow-emerald-500/10"
            } overflow-hidden`}>
              {isAllComplete ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </motion.div>
              ) : (
                <>
                  {/* Spinning Tech Ring */}
                  <div className="absolute inset-1 rounded-lg border border-dashed border-emerald-400/30 animate-[spin_6s_linear_infinite]" />
                  
                  {/* Scan Icon */}
                  <Scan className="h-6 w-6 text-emerald-400 relative z-10" />

                  {/* Laser Beam Scanning Bar */}
                  <motion.div
                    className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_8px_#34d399]"
                    animate={{
                      top: ["10%", "90%", "10%"],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </>
              )}

              {/* Sparkle Floating Badge */}
              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-xs">
                <Sparkles size={9} className="fill-slate-950" />
              </div>
            </div>

            {/* Active Step Headline & Dynamic Subtext */}
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.18 }}
                >
                  <h3 className={`text-sm font-bold leading-tight truncate ${isAllComplete ? 'text-emerald-300' : 'text-white'}`}>
                    {currentStep.label}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-emerald-300/80 leading-snug line-clamp-2">
                    {currentStep.sub}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Stepper / Process List (Paparan 4 proses berperingkat) */}
          <div className="mt-3 space-y-1.5 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
            {OCR_STEPS.map((step, idx) => {
              const isDone = idx < stepIndex || isAllComplete;
              const isCurrent = idx === stepIndex && !isAllComplete;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                    isCurrent
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-white shadow-xs"
                      : isDone
                      ? "text-emerald-300/90"
                      : "text-slate-500 opacity-60"
                  }`}
                >
                  {/* Status Indicator Dot / Icon */}
                  <div className="shrink-0 flex items-center justify-center">
                    {isDone ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
                        <Loader2 size={10} className="animate-spin" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-[9px] font-mono text-slate-400">
                        {step.id}
                      </div>
                    )}
                  </div>

                  {/* Step Name & Status Tag */}
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className={`truncate ${isCurrent ? "font-bold text-emerald-200" : isDone ? "font-semibold text-emerald-300/90" : "font-medium"}`}>
                      {step.shortTitle}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider animate-pulse shrink-0">
                        Sedang Berjalan
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold shrink-0">
                        Selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slim Progress Bar */}
          <div className="mt-3 relative w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden border border-emerald-500/20">
            <motion.div
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-300 ${
                isAllComplete
                  ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                  : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
              }`}
              initial={{ width: "25%" }}
              animate={{ width: `${currentStep.progressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Footer Status Row */}
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              {isAllComplete ? (
                <>
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Imbasan selesai, memuatkan data...</span>
                </>
              ) : (
                <>
                  <Loader2 size={11} className="animate-spin text-emerald-400" />
                  <span>Sila tunggu seketika ({secondsRemaining}s)...</span>
                </>
              )}
            </div>
            <span className={`font-bold ${isAllComplete ? 'text-emerald-300' : 'text-emerald-400'}`}>
              {currentStep.progressPercent}%
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
