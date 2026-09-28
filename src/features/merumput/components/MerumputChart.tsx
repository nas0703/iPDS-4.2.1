import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { SlidersHorizontal } from 'lucide-react';
import { MerumputProgress } from '../types';

interface MerumputChartProps {
  data: MerumputProgress[];
  isDarkMode?: boolean;
}

export const MerumputChart: React.FC<MerumputChartProps> = ({ data, isDarkMode }) => {
  const [selectedPusingan, setSelectedPusingan] = useState<number>(1);
  const [selectedJenis, setSelectedJenis] = useState<string>('DADA (R&S)');

  // Filter data to resolve duplication of blocks across jenis & pusingan
  const filteredData = data.filter(item => 
    item.pusingan === selectedPusingan && 
    (selectedJenis === 'ALL' || item.jenis === selectedJenis)
  );

  const chartData = filteredData.map(item => ({
    name: `Blok ${item.blok}`,
    'Luas (HA)': item.luas,
    'Selesai (HA)': item.hek_siap,
    'Kemajuan %': item.luas > 0 ? parseFloat(((item.hek_siap / item.luas) * 100).toFixed(1)) : 0
  }));

  // Sort blocks properly (putting LF at the end and numerical order for others)
  const sortedChartData = [...chartData].sort((a, b) => {
    const aClean = a.name.replace('Blok ', '').trim();
    const bClean = b.name.replace('Blok ', '').trim();
    
    if (aClean === 'LF') return 1;
    if (bClean === 'LF') return -1;
    
    const aNum = parseInt(aClean);
    const bNum = parseInt(bClean);
    if (isNaN(aNum) && isNaN(bNum)) return aClean.localeCompare(bClean);
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });

  return (
    <div className="grid grid-cols-1 gap-6 text-left">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[32px] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider italic">Graf Kemajuan Mengikut Blok</h4>
            <p className="text-[10px] text-slate-400 font-mono">Perbandingan keluasan selesai (HA) berbanding luas penuh blok.</p>
          </div>

          {/* Inline filters for Recharts block chart */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Pusingan Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-850 rounded-full">
              {[1, 2].map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPusingan(p)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black transition-all ${
                    selectedPusingan === p 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                  }`}
                >
                  P{p}
                </button>
              ))}
            </div>

            {/* Jenis Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-850 rounded-full">
              {[
                { id: 'ALL', label: 'SEMUA' },
                { id: 'BULATAN & LORONG', label: 'BULATAN' },
                { id: 'DADA (R&S)', label: 'DADA' }
              ].map(j => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJenis(j.id)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black transition-all ${
                    selectedJenis === j.id 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-zinc-600 dark:hover:text-white'
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-xs uppercase font-bold tracking-wider">
            Tiada data mencukupi untuk memaparkan carta.
          </div>
        ) : (
          <div className="h-72 w-full text-[10px] font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={8}
                  tickLine={false}
                />
                <YAxis 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '9px' }} />
                <Bar dataKey="Luas (HA)" fill={isDarkMode ? '#334155' : '#e2e8f0'} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Selesai (HA)" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {sortedChartData.map((entry, index) => {
                    const isCompleted = entry['Kemajuan %'] >= 99.9;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isCompleted ? '#10b981' : '#0d9488'} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
