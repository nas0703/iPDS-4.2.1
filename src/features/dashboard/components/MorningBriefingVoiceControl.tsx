import React from 'react';
import { 
  Volume2, VolumeX, Square, Play, Pause, SkipBack, SkipForward, Settings
} from 'lucide-react';

interface MorningBriefingVoiceControlProps {
  isSpeaking: boolean;
  isPaused: boolean;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  currentChunkIndex: number;
  totalChunks: number;
  currentSentenceText: string;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onPrevChunk: () => void;
  onNextChunk: () => void;
  onOpenAcronymModal: () => void;
}

export const MorningBriefingVoiceControl: React.FC<MorningBriefingVoiceControlProps> = ({
  isSpeaking,
  isPaused,
  speechRate,
  setSpeechRate,
  currentChunkIndex,
  totalChunks,
  currentSentenceText,
  onPlay,
  onPause,
  onResume,
  onStop,
  onPrevChunk,
  onNextChunk,
  onOpenAcronymModal,
}) => {
  return (
    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            {isSpeaking && !isPaused ? (
              <Volume2 className="w-4 h-4 animate-pulse text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">Kawalan Suara (Text-to-Speech)</h4>
            <p className="text-[10px] text-slate-400">
              {totalChunks > 0 ? `Ayat ${currentChunkIndex + 1} daripada ${totalChunks}` : 'Sedia untuk dibacakan'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenAcronymModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-semibold flex items-center gap-1 transition-colors"
            title="Kamus Sebutan Singkatan"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" /> Singkatan
          </button>
        </div>
      </div>

      {/* Main Playback Control Bar */}
      <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevChunk}
            disabled={!isSpeaking || currentChunkIndex <= 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Ayat Sebelumnya"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {!isSpeaking ? (
            <button
              onClick={onPlay}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Baca Taklimat
            </button>
          ) : isPaused ? (
            <button
              onClick={onResume}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Sambung
            </button>
          ) : (
            <button
              onClick={onPause}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-current" /> Jeda
            </button>
          )}

          <button
            onClick={onStop}
            disabled={!isSpeaking}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
            title="Henti Bacaan"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={onNextChunk}
            disabled={!isSpeaking || currentChunkIndex >= totalChunks - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Ayat Seterusnya"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-[10px]">
          <span className="text-slate-400">Kelajuan:</span>
          {[0.9, 1.0, 1.15, 1.25].map((rate) => (
            <button
              key={rate}
              onClick={() => setSpeechRate(rate)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                speechRate === rate
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      {/* Active Sentence Subtitle Box */}
      {isSpeaking && currentSentenceText && (
        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/20 text-xs text-slate-200 leading-relaxed font-medium animate-in fade-in">
          <span className="text-[10px] text-emerald-400 font-mono block mb-1 uppercase tracking-wider">
            Sedang Dibacakan:
          </span>
          "{currentSentenceText}"
        </div>
      )}
    </div>
  );
};
