import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { motion } from 'motion/react';
import { PruningRecord } from '../types';

interface PruningChartProps {
  data: PruningRecord[];
  isDarkMode: boolean;
}

export const PruningChart: React.FC<PruningChartProps> = ({ data, isDarkMode }) => {
  // Sort by block number if possible
  const chartData = [...data].sort((a, b) => {
    const numA = parseInt(a.blok.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.blok.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const record = payload[0].payload as PruningRecord;
      return (
        <div className={`p-4 rounded-2xl border shadow-2xl ${
          isDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Blok {label}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-xs font-medium">Keluasan:</span>
              <span className="text-xs font-bold">{(Number(record.luas) || 0).toFixed(2)} HA</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs font-medium">Siap:</span>
              <span className="text-xs font-bold">{(Number(record.jum_hektar_siap) || 0).toFixed(2)} HA</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-700/50 pt-1 mt-1">
              <span className="text-xs font-medium">Kemajuan:</span>
              <span className="text-xs font-black text-emerald-400">{(Number(record.peratus_siap) || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-[32px] border ${
        isDarkMode 
          ? 'bg-slate-900/40 border-white/5 shadow-2xl' 
          : 'bg-white border-slate-100 shadow-sm'
      }`}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className={`text-xl font-black leading-none mb-1 uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Analisa Kemajuan Blok</h3>
          <p className="text-xs text-slate-500 font-medium">Peratusan siap (cantas pelepah) mengikut blok</p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 
            />
            <XAxis 
              dataKey="blok" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700 }}
              interval={0}
            />
            <YAxis 
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
            <Bar 
              dataKey="peratus_siap" 
              radius={[6, 6, 0, 0]}
              animationDuration={1500}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.peratus_siap >= 100 ? '#10b981' : entry.peratus_siap >= 50 ? '#10b981' : '#10b981'} 
                  fillOpacity={entry.peratus_siap >= 100 ? 1 : 0.6}
                />
              ))}
              <LabelList 
                dataKey="peratus_siap" 
                position="top" 
                content={(props: any) => {
                  const { x, y, width, value } = props;
                  if (value === 0) return null;
                  return (
                    <text 
                      x={x + width / 2} 
                      y={y - 12} 
                      fill={isDarkMode ? '#94a3b8' : '#64748b'} 
                      textAnchor="middle" 
                      fontSize={8} 
                      fontWeight={900}
                      transform={`rotate(-90, ${x + width / 2}, ${y - 12})`}
                    >
                      {value.toFixed(0)}%
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
