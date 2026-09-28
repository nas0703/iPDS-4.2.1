import React, { useState } from 'react';
import { Layers, ShieldCheck, Users, Sprout, CheckCircle2 } from 'lucide-react';
import { MerumputProgress } from '../types';
import { getActiveEstateConfig } from '../../../config/estateRegistry';

interface MerumputMatrixAnalysisProps {
  data: MerumputProgress[];
  isDarkMode?: boolean;
}

export const MerumputMatrixAnalysis: React.FC<MerumputMatrixAnalysisProps> = ({ data, isDarkMode }) => {
  const [selectedPusingan, setSelectedPusingan] = useState<string>('1');

  // Load estate config for actual peringkat definitions
  const estateCfg = getActiveEstateConfig();
  const allBlocks = estateCfg && estateCfg.blocks 
    ? Object.values(estateCfg.blocks).map((b: any) => ({
        blok: String(b.blok),
        luas: Number(b.luas) || 0,
        pkt: b.pkt || '001'
      }))
    : [];

  const pkt1Blocks = allBlocks.filter(b => b.pkt === '001');
  const pkt2Blocks = allBlocks.filter(b => b.pkt === '002');
  const feldaBlocks = allBlocks.filter(b => b.pkt === '003');

  const getRangeText = (blockList: typeof allBlocks) => {
    if (blockList.length === 0) return '';
    const numericBlocks = blockList
      .map(b => parseInt(String(b.blok)))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    if (numericBlocks.length > 0 && numericBlocks.length === blockList.length) {
      return `${numericBlocks[0]} - ${numericBlocks[numericBlocks.length - 1]}`;
    }
    return blockList.map(b => b.blok).join(', ');
  };

  // Helper to calculate partition specifics for a specific treatment type (jenis)
  const getPartitionStatsForJenis = (targetBlocks: typeof allBlocks, targetJenis: string) => {
    const blockKeys = new Set(targetBlocks.map(b => String(b.blok).trim().toUpperCase()));
    if (blockKeys.has('88')) blockKeys.add('LF');
    if (blockKeys.has('LF')) blockKeys.add('88');

    const subData = data.filter(d => {
      // Filter by pusingan
      if (selectedPusingan !== 'ALL' && d.pusingan !== Number(selectedPusingan)) {
        return false;
      }
      // Filter strictly by targetJenis
      if (d.jenis !== targetJenis) {
        return false;
      }
      return blockKeys.has(String(d.blok).trim().toUpperCase());
    });

    const pusinganMultiplier = selectedPusingan === 'ALL' ? 2 : 1;
    const totalLuas = targetBlocks.reduce((acc, curr) => acc + curr.luas, 0) * pusinganMultiplier;
    const completedLuas = subData.reduce((acc, curr) => acc + curr.hek_siap, 0);
    const progressPct = totalLuas > 0 ? (completedLuas / totalLuas) * 100 : 0;

    return {
      totalLuas,
      completedLuas,
      progressPctStr: progressPct.toFixed(1),
      progressPct
    };
  };

  // Helper to calculate general information for the partition (count of blocks, total workers)
  const getPartitionGeneralStats = (targetBlocks: typeof allBlocks) => {
    const blockKeys = new Set(targetBlocks.map(b => String(b.blok).trim().toUpperCase()));
    if (blockKeys.has('88')) blockKeys.add('LF');
    if (blockKeys.has('LF')) blockKeys.add('88');

    const subData = data.filter(d => {
      if (selectedPusingan !== 'ALL' && d.pusingan !== Number(selectedPusingan)) {
        return false;
      }
      return blockKeys.has(String(d.blok).trim().toUpperCase());
    });

    const totalWorkers = subData.reduce((acc, curr) => acc + (curr.workers_count || 0), 0);
    return {
      blockCount: targetBlocks.length,
      totalWorkers
    };
  };

  const partitions = [
    {
      title: 'Peringkat 1',
      blocksRange: getRangeText(pkt1Blocks),
      blocks: pkt1Blocks,
      theme: {
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        progressBar: 'bg-emerald-500',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
      }
    },
    ...(pkt2Blocks.length > 0 ? [{
      title: 'Peringkat 2',
      blocksRange: getRangeText(pkt2Blocks),
      blocks: pkt2Blocks,
      theme: {
        badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        progressBar: 'bg-blue-500',
        iconBg: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
      }
    }] : []),
    ...(feldaBlocks.length > 0 ? [{
      title: 'Kawasan / Lot FELDA',
      blocksRange: getRangeText(feldaBlocks),
      blocks: feldaBlocks,
      theme: {
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
        progressBar: 'bg-amber-550',
        iconBg: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
      }
    }] : [])
  ];

  return (
    <div className="space-y-4 text-left">
      {/* Title Section */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-3.5 rounded-[16px] text-white shadow-md">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-300 shrink-0">
          <Layers size={16} />
        </div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-300 leading-none">
            Matriks Kemajuan Merumput
          </h4>
          <p className="text-[8px] text-slate-300 font-bold tracking-wider uppercase mt-1 leading-none">
            Analisis Mengikut Pusingan, Jenis & Peringkat Ladang
          </p>
        </div>
      </div>

      {/* Interactive Filters */}
      <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/25 px-4 py-2.5 rounded-xl border border-slate-150 dark:border-slate-800/40">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tapisan Pusingan:</span>
        <div className="flex gap-1.5">
          {[
            { id: '1', label: 'Pusingan 1' },
            { id: '2', label: 'Pusingan 2' },
            { id: 'ALL', label: 'Semua' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPusingan(p.id)}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                selectedPusingan === p.id
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {partitions.map((part, index) => {
          const statsBulatan = getPartitionStatsForJenis(part.blocks, 'BULATAN & LORONG');
          const statsDada = getPartitionStatsForJenis(part.blocks, 'DADA (R&S)');
          const general = getPartitionGeneralStats(part.blocks);

          return (
            <div 
              key={index} 
              className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-3.5 rounded-[22px] shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all duration-300 group"
            >
              {/* Header info */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${part.theme.badgeColor}`}>
                    {general.blockCount} Blok ({part.blocksRange})
                  </span>
                </div>

                <div>
                  <h5 className="text-xs font-black text-slate-850 dark:text-white uppercase leading-tight group-hover:text-emerald-500 transition-colors">
                    {part.title}
                  </h5>
                </div>
              </div>

              {/* Progress bars for both work types */}
              <div className="space-y-3">
                {/* BULATAN & LORONG Progress Bar */}
                <div className="space-y-1 bg-slate-50 dark:bg-slate-850/40 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                  <div className="flex items-baseline justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Bulatan & Lorong</span>
                    <span className="text-[9.5px] font-mono">
                      {statsBulatan.completedLuas.toFixed(2)} <span className="text-[7.5px] text-slate-400">/ {statsBulatan.totalLuas.toFixed(1)} HA</span>
                    </span>
                  </div>

                  {/* High precision Progress Bar with green completed line */}
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 bg-emerald-500"
                        style={{ width: `${Math.min(100, statsBulatan.progressPct)}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono font-black text-slate-500 min-w-[32px] text-right">
                      {statsBulatan.progressPctStr}%
                    </span>
                  </div>
                </div>

                {/* DADA (R&S) Progress Bar */}
                <div className="space-y-1 bg-slate-50 dark:bg-slate-850/40 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/40">
                  <div className="flex items-baseline justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Dada (R&S)</span>
                    <span className="text-[9.5px] font-mono">
                      {statsDada.completedLuas.toFixed(2)} <span className="text-[7.5px] text-slate-400">/ {statsDada.totalLuas.toFixed(1)} HA</span>
                    </span>
                  </div>

                  {/* High precision Progress Bar with green completed line */}
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 bg-emerald-500"
                        style={{ width: `${Math.min(100, statsDada.progressPct)}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-mono font-black text-slate-500 min-w-[32px] text-right">
                      {statsDada.progressPctStr}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Workers detail footer */}
              <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 text-[8.5px]">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <Users size={10} className="text-zinc-400" />
                  <span>{general.totalWorkers} Pekerja</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
