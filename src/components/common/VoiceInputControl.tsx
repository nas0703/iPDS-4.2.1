import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Globe,
  Radio,
  AlertCircle,
  Loader2,
  ExternalLink,
  Check
} from 'lucide-react';
import { UseVoiceInputReturn } from '../../hooks/useVoiceInput';

interface VoiceInputControlProps {
  voiceInput: UseVoiceInputReturn;
  onSendDirectly?: (text: string) => void;
  onApplyText?: (text: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const VoiceInputControl: React.FC<VoiceInputControlProps> = ({
  voiceInput,
  onSendDirectly,
  onApplyText,
  compact = false
}) => {
  const {
    isListening,
    isProcessing,
    isSupported,
    isPermissionDenied,
    language,
    transcript,
    interimTranscript,
    combinedText,
    audioLevel,
    listeningDuration,
    error,
    toggleListening,
    stopListening,
    resetTranscript,
    setLanguage
  } = voiceInput;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLanguageToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (language === 'ms-MY') {
      setLanguage('en-US');
    } else {
      setLanguage('ms-MY');
    }
  };

  const handleDirectSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const finalResult = await stopListening();
    const textToSend = (finalResult || combinedText).trim();
    if (textToSend && onSendDirectly) {
      onSendDirectly(textToSend);
      resetTranscript();
    }
  };

  const handleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const finalResult = await stopListening();
    const textToSend = (finalResult || combinedText).trim();
    if (textToSend) {
      if (onSendDirectly) {
        onSendDirectly(textToSend);
      } else if (onApplyText) {
        onApplyText(textToSend);
      }
      resetTranscript();
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopListening();
    resetTranscript();
  };

  const openInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className="p-2 rounded-xl text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
        title="Pengecaman suara tidak disokong pada pelayar ini (Gunakan Chrome/Edge/Safari)"
      >
        <MicOff size={16} />
      </button>
    );
  }

  // Waveform heights
  const baseHeights = [30, 60, 95, 100, 85, 55, 35, 75, 50];

  return (
    <div className="relative flex items-center shrink-0">
      {/* Microphone Trigger Button */}
      <button
        type="button"
        onClick={toggleListening}
        className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer relative ${
          isListening
            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-400 animate-pulse'
            : isProcessing
            ? 'bg-amber-600 text-white animate-spin'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
        }`}
        title={
          isListening
            ? 'Hentikan rakaman suara'
            : isProcessing
            ? 'Sedang mengekstrak teks...'
            : 'Bercakap soalan melalui Mikrofon (Input Suara BM/EN)'
        }
      >
        {isProcessing ? (
          <Loader2 size={compact ? 14 : 16} className="animate-spin" />
        ) : (
          <Mic size={compact ? 14 : 16} className={isListening ? 'scale-110' : ''} />
        )}

        {isListening && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-400 rounded-full animate-ping" />
        )}
      </button>

      {/* Full Live Voice Modal/Overlay - Positioned Fixed on Mobile & Docked on Desktop */}
      <AnimatePresence>
        {(isListening || isProcessing || isPermissionDenied || error) && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 bottom-24 sm:bottom-28 sm:left-auto sm:right-4 sm:w-96 max-w-lg mx-auto p-4 rounded-2xl bg-slate-900/98 dark:bg-slate-950/98 backdrop-blur-xl border border-rose-500/50 shadow-2xl shadow-black/80 text-slate-100 z-[99999] space-y-3"
          >
            {/* Header: Status, Language & Duration */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                      Mendengar Suara
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {formatDuration(listeningDuration)}
                    </span>
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 size={14} className="text-amber-400 animate-spin" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Memproses AI...
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Status Mikrofon
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={handleLanguageToggle}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-black text-emerald-400 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  title="Tukar bahasa pengecaman suara"
                >
                  <Globe size={12} />
                  <span>{language === 'ms-MY' ? '🇲🇾 Melayu' : '🇬🇧 English'}</span>
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title="Tutup / Batal"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* If Permission Denied / Error Banner */}
            {isPermissionDenied || error ? (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 space-y-2.5 text-xs">
                <div className="flex items-start gap-2 text-rose-300 font-semibold leading-snug">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{error || 'Akses mikrofon disekat oleh pelayar.'}</span>
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed">
                  Sila klik ikon kunci / tetapan di bar alamat pelayar untuk membenarkan mikrofon, atau buka di tab baharu.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={openInNewTab}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <ExternalLink size={13} />
                    <span>Buka Dalam Tab Baharu</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sound Wave Graphic Equilizer */}
                <div className="h-9 px-4 bg-slate-950/80 rounded-xl border border-slate-800/90 flex items-center justify-center gap-2">
                  {baseHeights.map((bh, i) => {
                    const dynamicHeight = Math.max(
                      12,
                      Math.round(bh * ((audioLevel + 25) / 100))
                    );
                    return (
                      <motion.div
                        key={i}
                        animate={{ height: `${dynamicHeight}%` }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className={`w-2 rounded-full transition-all duration-100 ${
                          audioLevel > 15
                            ? 'bg-gradient-to-t from-rose-500 via-amber-400 to-emerald-400'
                            : 'bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Live Realtime Transcript Box */}
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 min-h-[50px] max-h-28 overflow-y-auto">
                  {isProcessing ? (
                    <p className="text-xs text-amber-300 italic flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin text-amber-400" />
                      Sedang memproses audio dengan Gemini AI...
                    </p>
                  ) : combinedText ? (
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                      {transcript && <span>{transcript} </span>}
                      {interimTranscript && (
                        <span className="text-rose-400 italic font-normal">
                          {interimTranscript}...
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic flex items-center gap-2">
                      <Radio size={13} className="text-rose-500 animate-pulse shrink-0" />
                      <span>Sila sebut soalan anda sekarang (cth: "Berapa tan EFB bulan ini?" atau "Kadar upah tuai")...</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-[10px] text-slate-300 truncate">
                      {audioLevel > 15
                        ? 'Suara dikesan... carian bermula sejurus selesai sebut'
                        : '⚡ Auto-carian: Serta-merta dihantar bila selesai bercakap'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDone}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                      title="Selesai bercakap & hantar soalan"
                    >
                      <Check size={12} />
                      <span>Selesai</span>
                    </button>

                    {onSendDirectly && (
                      <button
                        type="button"
                        onClick={handleDirectSend}
                        disabled={!combinedText.trim() && !isListening}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black text-white shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <Send size={12} />
                        <span>Hantar</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
