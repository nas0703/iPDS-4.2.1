import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Table, BarChart3 } from 'lucide-react';
import { MALAY_MONTHS_SHORT } from '../../../utils/formatters';

const years = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'];

const COLORS = [
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
];

const LaporanHujanViewComponent: React.FC<{ data: any[] }> = ({ data = [] }) => {
  const [viewMode, setViewMode] = useState<'jadual' | 'analitik'>('jadual');

  // Prepare Yearly Data
  const yearlyData = useMemo(() => {
    return years.map(year => {
      const sum = data.reduce((acc, item) => {
        if (item.bulan !== 'JUMLAH') {
          const val = item[year];
          return acc + (typeof val === 'number' ? val : 0);
        }
        return acc;
      }, 0);
      return { year, jumlah: sum };
    });
  }, [data]);

  // Prepare Monthly Data
  const monthlyData = useMemo(() => {
    return data.filter(d => d.bulan !== 'JUMLAH');
  }, [data]);

  const currentMonthName = MALAY_MONTHS_SHORT[new Date().getMonth()].toUpperCase();
  const currentYear = new Date().getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 shadow-sm mx-auto max-w-xs">
        <button
          onClick={() => setViewMode('jadual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
            viewMode === 'jadual'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Table size={14} /> Jadual
        </button>
        <button
          onClick={() => setViewMode('analitik')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
            viewMode === 'analitik'
              ? 'bg-blue-500 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BarChart3 size={14} /> Analitik
        </button>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'jadual' ? (
          <motion.div
            key="jadual"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 rounded-[24px] p-4 shadow-xl border border-slate-800 overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-transparent pointer-events-none" />
            
            <h2 className="text-center text-lg md:text-xl font-display font-black text-white uppercase tracking-widest mb-6 relative z-10 drop-shadow-lg">
              LAPORAN HUJAN SEHINGGA {currentMonthName} {currentYear}
            </h2>

            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr>
                    <th className="border border-slate-700 bg-slate-800 text-white font-bold p-2 text-xs">
                      BULAN
                    </th>
                    {years.map((year) => (
                      <th key={year} className="border border-slate-700 bg-slate-800 text-white font-bold p-2 text-xs">
                        {year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => {
                    const isTotal = row.bulan === 'JUMLAH';
                    return (
                      <tr key={index} className={isTotal ? 'bg-slate-800/80 font-bold' : 'hover:bg-slate-800/50'}>
                        <td className={`border border-slate-700 p-2 text-xs font-bold ${isTotal ? 'text-white' : 'text-slate-300'}`}>
                          {row.bulan}
                        </td>
                        {years.map((year) => {
                          let val = (row as any)[year];
                          if (isTotal) {
                            val = data.reduce((sum, item) => {
                              if (item.bulan !== 'JUMLAH') {
                                const v = (item as any)[year];
                                return sum + (typeof v === 'number' ? v : 0);
                              }
                              return sum;
                            }, 0);
                            if (val === 0) val = null;
                          }

                          const isLow = val != null && val <= 100;
                          return (
                            <td 
                              key={year} 
                              className={`border border-slate-700 p-2 text-xs font-mono
                                ${val == null ? '' : isLow ? 'text-red-500 font-bold' : 'text-white'}
                              `}
                            >
                              {val != null && typeof val === 'number' ? val.toFixed(2) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analitik"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Yearly Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-lg border border-slate-200 dark:border-slate-800">
              <h3 className="text-center text-sm md:text-md font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">
                Jumlah Hujan Tahunan (mm)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis 
                      dataKey="year" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(51, 65, 85, 0.1)' }}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value.toFixed(2)} mm`, 'Jumlah']}
                    />
                    <Bar dataKey="jumlah" radius={[6, 6, 0, 0]}>
                      {yearlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-lg border border-slate-200 dark:border-slate-800">
              <h3 className="text-center text-sm md:text-md font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">
                Tren Hujan Bulanan (mm)
              </h3>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis 
                      dataKey="bulan" 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                    {years.map((year, index) => (
                      <Line 
                        key={year} 
                        type="monotone" 
                        dataKey={year} 
                        name={year}
                        stroke={COLORS[index % COLORS.length]} 
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 2 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const LaporanHujanView = React.memo(LaporanHujanViewComponent);

