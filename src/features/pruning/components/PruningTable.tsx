import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { PruningRecord } from '../types';
import { Search, Calendar, ChevronDown, CheckCircle, Clock, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface PruningTableProps {
  data: PruningRecord[];
  isDarkMode: boolean;
  onEdit?: (record: PruningRecord) => void;
}

type SortKey = 'blok' | 'peratus_siap' | null;
type SortDirection = 'asc' | 'desc';

export const PruningTable: React.FC<PruningTableProps> = ({ data, isDarkMode, onEdit }) => {
  const [sortKey, setSortKey] = useState<SortKey>('blok');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (percent >= 80) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (percent > 0) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  const getStatusLabel = (percent: number) => {
    if (percent >= 100) return 'COMPLETED';
    if (percent >= 80) return 'ALMOST DONE';
    if (percent > 0) return 'IN PROGRESS';
    return 'NOT STARTED';
  };

  const getStatusIcon = (percent: number) => {
    if (percent >= 100) return <CheckCircle size={10} />;
    if (percent >= 80) return <Clock size={10} />;
    if (percent > 0) return <Clock size={10} />;
    return <AlertTriangle size={10} />;
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];

      if (sortKey === 'blok') {
        aVal = parseFloat(a.blok) || a.blok;
        bVal = parseFloat(b.blok) || b.blok;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown size={10} className="text-slate-400 opacity-30 group-hover:opacity-100 transition-opacity" />;
    return sortDirection === 'asc' ? <ArrowUp size={10} className="text-emerald-500" /> : <ArrowDown size={10} className="text-emerald-500" />;
  };

  return (
    <div className={`overflow-hidden rounded-2xl border ${isDarkMode ? 'bg-slate-900/40 border-white/5 shadow-2xl' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`border-b ${isDarkMode ? 'border-white/5 bg-slate-900/60' : 'border-slate-100 bg-slate-50'}`}>
              <th 
                className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap cursor-pointer group hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => handleSort('blok')}
              >
                <div className="flex items-center gap-1 justify-start">
                  Blok
                  <SortIcon columnKey="blok" />
                </div>
              </th>
              <th className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Luas</th>
              <th className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center">Kontrak</th>
              <th className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Cekrol</th>
              <th className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Jum Siap</th>
              <th 
                className="px-2 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest cursor-pointer group hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => handleSort('peratus_siap')}
              >
                <div className="flex items-center gap-1 justify-start">
                  Progress
                  <SortIcon columnKey="peratus_siap" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((record, idx) => (
              <motion.tr
                key={record.blok}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                onClick={() => onEdit?.(record)}
                className={`group cursor-pointer hover:bg-emerald-500/5 transition-all w-full`}
              >
                <td className="px-2 py-1.5 w-10">
                  <span className={`text-[10px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{record.blok}</span>
                </td>
                <td className="px-2 py-1.5 w-12">
                  <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{(Number(record.luas) || 0).toFixed(1)}</span>
                </td>
                <td className="px-2 py-1.5 text-center w-12">
                  <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{(Number(record.hek_siap_pekerja) || 0).toFixed(1)}</span>
                </td>
                <td className="px-2 py-1.5 text-center w-12">
                  <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{(Number(record.hek_pekerja_cekrol) || 0).toFixed(1)}</span>
                </td>
                <td className="px-2 py-1.5 text-center w-12">
                  <span className={`text-[10px] font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{(Number(record.jum_hektar_siap) || 0).toFixed(1)}</span>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <div className="flex justify-between items-center text-[7px] font-black leading-none mb-0.5">
                      <span className={`${getStatusColor(Number(record.peratus_siap) || 0).split(' ')[0]}`}>{(Number(record.peratus_siap) || 0).toFixed(0)}%</span>
                      <span className={`px-1 py-0.5 rounded text-[5px] uppercase tracking-widest ${getStatusColor(Number(record.peratus_siap) || 0)}`}>
                        {getStatusLabel(Number(record.peratus_siap) || 0)}
                      </span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden border ${isDarkMode ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(Number(record.peratus_siap) || 0, 100)}%` }}
                        className={`h-full rounded-full bg-gradient-to-r ${
                          (Number(record.peratus_siap) || 0) >= 100 ? 'from-emerald-400 to-emerald-500' :
                          (Number(record.peratus_siap) || 0) >= 80 ? 'from-blue-400 to-blue-500' :
                          (Number(record.peratus_siap) || 0) > 0 ? 'from-amber-400 to-amber-500' : 'from-slate-600 to-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
