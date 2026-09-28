import React, { useState } from 'react';
import { WeedingSummary } from '../types';
import { 
  Sprout, 
  Map, 
  CheckCircle2, 
  AlertTriangle, 
  Flame,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Clock
} from 'lucide-react';

interface MerumputDashboardProps {
  summary: WeedingSummary;
  isDarkMode?: boolean;
}

export const MerumputDashboard: React.FC<MerumputDashboardProps> = ({ summary, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2 text-left">
      {/* Toggle Button for Stats Summary */}
      <div className="flex justify-start">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-150 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-black text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-sm"
        >
          <SlidersHorizontal size={10} className="text-teal-500" />
          <span>{isOpen ? 'Sembunyikan Info Ringkasan' : 'Tunjukkan Info Ringkasan'}</span>
          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mr-0.5 animate-in fade-in zoom-in duration-300">
          {/* Total Luas */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center text-teal-500 shrink-0">
              <Map size={16} />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Jumlah Area</p>
              <p className="text-sm font-display font-black text-slate-800 dark:text-white leading-none truncate">
                {summary.totalLuas.toFixed(2)} <span className="text-[8px] font-black text-slate-400">HA</span>
              </p>
            </div>
          </div>

          {/* Hektar Siap */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 size={16} />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Hektar Siap</p>
              <p className="text-sm font-display font-black text-slate-800 dark:text-white leading-none truncate">
                {summary.totalHektarSiap.toFixed(2)} <span className="text-[8px] font-black text-slate-400">HA</span>
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
              <Sprout size={16} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Kemajuan</p>
              <div className="flex items-baseline justify-between leading-none gap-1">
                <span className="text-xs font-display font-black text-slate-800 dark:text-white">
                  {summary.overallProgress.toFixed(1)}%
                </span>
                <span className="text-[6.5px] font-black text-slate-400 uppercase truncate">
                  Baki: {summary.remainingHektar.toFixed(0)} HA
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${Math.min(100, summary.overallProgress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Overdue Rotation Warning > 120 Days */}
          <div className={`border p-2.5 rounded-2xl shadow-sm flex items-center gap-2 transition-all ${
            summary.overdueBlocksCount > 0 
              ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30 text-amber-500' 
              : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              summary.overdueBlocksCount > 0 
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/23' 
                : 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-400'
            }`}>
              <Clock size={16} className={summary.overdueBlocksCount > 0 ? "animate-pulse" : ""} />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-wider leading-none">Overdue &gt; 120 Hari</p>
              <p className={`text-sm font-display font-black leading-none truncate ${summary.overdueBlocksCount > 0 ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 'text-slate-800 dark:text-white'}`}>
                {summary.overdueBlocksCount} <span className="text-[8px] font-black">BLOK</span>
              </p>
            </div>
          </div>

          {/* Inventory Stock Warning Alert */}
          <div className={`border p-2.5 rounded-2xl shadow-sm flex items-center gap-2 transition-all ${
            summary.lowStockCount > 0 
              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-950/40 text-rose-500' 
              : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              summary.lowStockCount > 0 
                ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-500' 
                : 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-400'
            }`}>
              {summary.lowStockCount > 0 ? <AlertTriangle size={16} className="animate-pulse" /> : <Flame size={16} />}
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-[8px] font-black uppercase tracking-wider leading-none">Stok Rendah</p>
              <p className={`text-sm font-display font-black leading-none truncate ${summary.lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}>
                {summary.lowStockCount} <span className="text-[8px] font-black">JENIS</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
