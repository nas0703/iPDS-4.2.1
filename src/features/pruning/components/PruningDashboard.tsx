import React from 'react';
import { motion } from 'motion/react';
import { PruningSummary } from '../types';
import { LayoutDashboard, Target, CheckCircle2, AlertCircle } from 'lucide-react';

interface PruningDashboardProps {
  summary: PruningSummary;
  isDarkMode: boolean;
}

export const PruningDashboard: React.FC<PruningDashboardProps> = ({ summary, isDarkMode }) => {
  const totalLuas = Number(summary?.totalLuas) || 0;
  const totalHektarSiap = Number(summary?.totalHektarSiap) || 0;
  const remainingHektar = Number(summary?.remainingHektar) || 0;
  const overallProgress = Number(summary?.overallProgress) || 0;

  const cards = [
    {
      title: 'TOTAL LUAS',
      value: `${totalLuas.toFixed(2)}`,
      unit: 'HA',
      icon: <LayoutDashboard size={20} className="text-blue-500" />,
      color: 'blue'
    },
    {
      title: 'HEKTAR SIAP',
      value: `${totalHektarSiap.toFixed(2)}`,
      unit: 'HA',
      icon: <CheckCircle2 size={20} className="text-emerald-500" />,
      color: 'emerald'
    },
    {
      title: 'BAKI HEKTAR',
      value: `${remainingHektar.toFixed(2)}`,
      unit: 'HA',
      icon: <AlertCircle size={20} className="text-rose-500" />,
      color: 'rose'
    },
    {
      title: 'KESELURUHAN',
      value: `${overallProgress.toFixed(1)}`,
      unit: '%',
      icon: <Target size={20} className="text-amber-500" />,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-4 rounded-3xl border ${
              isDarkMode 
                ? 'bg-slate-900/50 border-white/5 shadow-xl shadow-black/20' 
                : 'bg-white border-slate-100 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {card.icon}
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                {card.title}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {card.value}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {card.unit}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Overall Progress Bar */}
      <div className={`p-6 rounded-[32px] border ${
        isDarkMode 
          ? 'bg-slate-900/40 border-white/5 shadow-2xl' 
          : 'bg-white border-slate-100 shadow-sm'
      }`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className={`text-xl font-black leading-none mb-1 uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Prestasi Cantas Pelepah 2026</h3>
            <p className="text-xs text-slate-500 font-medium">Keluasan keseluruhan ladang FPMSB Tunggal</p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-black ${
              overallProgress >= 80 ? 'text-emerald-500' : 
              overallProgress >= 50 ? 'text-amber-500' : 'text-rose-500'
            }`}>
              {overallProgress.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <div className={`h-4 w-full rounded-full overflow-hidden border shadow-inner ${isDarkMode ? 'bg-slate-800 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(overallProgress, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${
              summary.overallProgress >= 80 ? 'bg-emerald-500' : 
              summary.overallProgress >= 50 ? 'bg-amber-400' : 'bg-rose-500'
            } shadow-[0_0_15px_rgba(16,185,129,0.3)]`}
          />
        </div>
      </div>
    </div>
  );
};
