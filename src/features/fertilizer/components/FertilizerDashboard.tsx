
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Package, 
  TrendingUp, 
  Zap
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend
} from 'recharts';
import { getPusInfo, getProgressStatus, calculateProgress } from '../helpers';
import { getActiveEstateId, ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { safeFetch } from '../../../utils/safeFetch';
import { FERTILIZER_PROGRAM_2026, getFertilizerMasterForEstate, FertilizerBlockProgram } from '../program_data';
import { getEstateConfig } from '../../../config/estateRegistry';

export const FertilizerDashboard: React.FC<{ authRole: string }> = ({ authRole }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [master, setMaster] = useState<FertilizerBlockProgram[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEstate, setActiveEstate] = useState<string>(() => getActiveEstateId());

  useEffect(() => {
    const handleEstateChange = (e?: any) => {
      const newEstateId = e?.detail?.estateId || getActiveEstateId();
      setActiveEstate(newEstateId);
    };

    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    window.addEventListener('storage', handleEstateChange);
    return () => {
      window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
      window.removeEventListener('storage', handleEstateChange);
    };
  }, []);

  useEffect(() => {
    const start = Date.now();
    const isTunggal = activeEstate === 'FPM_TUNGGAL';
    const estateCfg = getEstateConfig(activeEstate);

    const fetchData = async () => {
      try {
        const [entriesRes, masterRes, transRes] = await Promise.all([
          safeFetch(`/api/fertilizer/entries?estate_id=${activeEstate}`).catch(() => null),
          safeFetch(`/api/fertilizer/master?estate_id=${activeEstate}`).catch(() => null),
          safeFetch(`/api/fertilizer/inventory/transactions?estate_id=${activeEstate}`).catch(() => null)
        ]);
        const entriesData = entriesRes && entriesRes.ok ? await entriesRes.json().catch(() => []) : [];
        const masterData = masterRes && masterRes.ok ? await masterRes.json().catch(() => []) : [];
        const transData = transRes && transRes.ok ? await transRes.json().catch(() => []) : [];

        let finalMaster: FertilizerBlockProgram[] = getFertilizerMasterForEstate(activeEstate, estateCfg.blocks);
        if (Array.isArray(masterData) && masterData.length > 0) {
          finalMaster = masterData.map((d: any) => {
            const bCode = String(d.blok_code || d.blok || '').trim();
            const p1 = Number(d.pus1_beg ?? d.pus1 ?? 0);
            const p2 = Number(d.pus2_beg ?? d.pus2 ?? 0);
            const p3 = Number(d.pus3_beg ?? d.pus3 ?? 0);
            const p4 = Number(d.pus4_beg ?? d.pus4 ?? 0);
            return {
              blok: bCode,
              blok_code: bCode,
              luas: Number(d.luas_ha ?? d.luas ?? 0),
              luas_ha: Number(d.luas_ha ?? d.luas ?? 0),
              dirian: Number(d.dirian ?? 136),
              pokok: Number(d.pokok ?? 0),
              pus1: p1,
              pus2: p2,
              pus3: p3,
              pus4: p4,
              pus1_beg: p1,
              pus2_beg: p2,
              pus3_beg: p3,
              pus4_beg: p4,
              compact_total_beg: Number(d.compact_total_beg ?? (p1 + p4)),
              organic_total_beg: Number(d.organic_total_beg ?? (p2 + p3)),
              grand_total_beg: Number(d.grand_total_beg ?? (p1 + p2 + p3 + p4)),
              pkt: d.pkt || "001",
              estate_id: activeEstate
            };
          }).filter((item: any) => item.blok_code.length > 0);
        }
        
        const filteredEntries = Array.isArray(entriesData) ? entriesData.filter((item: any) => {
          if (isTunggal) return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
          return item.estate_id === activeEstate;
        }) : [];

        const filteredTrans = Array.isArray(transData) ? transData.filter((item: any) => {
          if (isTunggal) return !item.estate_id || item.estate_id === 'FPM_TUNGGAL';
          return item.estate_id === activeEstate;
        }) : [];

        setEntries(filteredEntries);
        setMaster(finalMaster);
        setInventoryTransactions(filteredTrans);
      } catch (err) {
        console.error('Failed to fetch data', err);
        setMaster(getFertilizerMasterForEstate(activeEstate, estateCfg.blocks));
      } finally {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 350 - elapsed);
        setTimeout(() => {
          setIsLoading(false);
        }, delay);
      }
    };
    fetchData();
  }, [activeEstate]);

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>;

  // KPI Calculations
  const dToday = new Date();
  const today = `${dToday.getFullYear()}-${String(dToday.getMonth() + 1).padStart(2, '0')}-${String(dToday.getDate()).padStart(2, '0')}`;
  const entriesArray = Array.isArray(entries) ? entries : [];
  const masterArray = Array.isArray(master) && master.length > 0 ? master : FERTILIZER_PROGRAM_2026;
  
  const todayEntries = entriesArray.filter(e => e.entry_date === today);
  const totalWorkersToday = todayEntries.reduce((acc, curr) => acc + (Number(curr.workers_count) || 0), 0) || (entriesArray.length > 0 ? 0 : 18);
  const totalBegToday = todayEntries.reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0) || (entriesArray.length > 0 ? 0 : 720);
  const avgProductivityToday = totalWorkersToday > 0 ? parseFloat((totalBegToday / totalWorkersToday).toFixed(2)) : (entriesArray.length > 0 ? 0 : 40.0);

  // Monthly/PUS breakdown targets & actuals
  const pus1Target = masterArray.reduce((acc, curr) => acc + (Number(curr.pus1_beg) ?? Number(curr.pus1) ?? 0), 0) || 12503;
  const pus2Target = masterArray.reduce((acc, curr) => acc + (Number(curr.pus2_beg) ?? Number(curr.pus2) ?? 0), 0) || 9009;
  const pus3Target = masterArray.reduce((acc, curr) => acc + (Number(curr.pus3_beg) ?? Number(curr.pus3) ?? 0), 0) || 9009;
  const pus4Target = masterArray.reduce((acc, curr) => acc + (Number(curr.pus4_beg) ?? Number(curr.pus4) ?? 0), 0) || 9812;

  // Filter out mock seed entries if real entries exist for each block & pus
  const cleanEntriesArray = (() => {
    const raw = Array.isArray(entries) ? entries : [];
    const groups = new Map<string, any[]>();
    raw.forEach(e => {
      const k = `${e.blok_code || e.blok}_${e.pus}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    });
    const result: any[] = [];
    groups.forEach(group => {
      const real = group.filter(e => !String(e.id || '').startsWith('p1-') && !String(e.id || '').startsWith('p2-') && !String(e.id || '').startsWith('p3-'));
      const chosen = real.length > 0 ? real : group;
      result.push(...chosen);
    });
    return result;
  })();

  const rawP1Actual = cleanEntriesArray.filter(e => Number(e.pus) === 1).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
  const rawP2Actual = cleanEntriesArray.filter(e => Number(e.pus) === 2).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
  const rawP3Actual = cleanEntriesArray.filter(e => Number(e.pus) === 3).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
  const rawP4Actual = cleanEntriesArray.filter(e => Number(e.pus) === 4).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);

  // PUS 1, PUS 2, and PUS 3 are completed (100% target or actual recorded sum)
  const pus1Actual = rawP1Actual > 0 ? Math.min(pus1Target, rawP1Actual) : pus1Target;
  const pus2Actual = rawP2Actual > 0 ? Math.min(pus2Target, rawP2Actual) : pus2Target;
  const pus3Actual = rawP3Actual > 0 ? Math.min(pus3Target, rawP3Actual) : pus3Target;
  const pus4Actual = rawP4Actual > 0 ? rawP4Actual : 0;

  // Progress Calculations
  const totalTarget = pus1Target + pus2Target + pus3Target + pus4Target;
  const totalActual = pus1Actual + pus2Actual + pus3Actual + pus4Actual;
  const overallProgress = calculateProgress(totalActual, totalTarget);

  const pusData = [
    { 
      name: 'PUS 1 (FEB)', 
      target: pus1Target, 
      actual: pus1Actual, 
      pct: pus1Target > 0 ? Math.min(100, Math.round((pus1Actual / pus1Target) * 100)) : 0, 
      color: '#059669' 
    },
    { 
      name: 'PUS 2 (APR)', 
      target: pus2Target, 
      actual: pus2Actual, 
      pct: pus2Target > 0 ? Math.min(100, Math.round((pus2Actual / pus2Target) * 100)) : 0, 
      color: '#10b981' 
    },
    { 
      name: 'PUS 3 (JUN)', 
      target: pus3Target, 
      actual: pus3Actual, 
      pct: pus3Target > 0 ? Math.min(100, Math.round((pus3Actual / pus3Target) * 100)) : 0, 
      color: '#34d399' 
    },
    { 
      name: 'PUS 4 (AUG)', 
      target: pus4Target, 
      actual: pus4Actual, 
      pct: pus4Target > 0 ? Math.min(100, Math.round((pus4Actual / pus4Target) * 100)) : 0, 
      color: '#059669' 
    },
  ];

  const compactTarget = pus1Target + pus4Target;
  const compactActual = entriesArray.length > 0 
    ? entriesArray.filter(e => [1, 4].includes(Number(e.pus))).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0)
    : (pus1Actual + pus4Actual);
  const compactProgress = calculateProgress(compactActual, compactTarget);

  const organicTarget = pus2Target + pus3Target;
  const organicActual = entriesArray.length > 0 
    ? entriesArray.filter(e => [2, 3].includes(Number(e.pus))).reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0)
    : (pus2Actual + pus3Actual);
  const organicProgress = calculateProgress(organicActual, organicTarget);

  const stats = [
    { label: 'Pekerja Hari Ini', value: totalWorkersToday, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Beg Siap Hari Ini', value: totalBegToday, icon: Package, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Produktiviti', value: avgProductivityToday, unit: 'BEG/PEK', icon: Zap, color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { label: 'Progress Program', value: overallProgress, unit: '%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-600/10' }
  ];

  // Process inventory transactions that are linked to blocks
  const blockStockIssued = (inventoryTransactions || [])
    .filter(t => t.type === 'OUT' && t.reference && t.reference.match(/BLOK\s?\d+/i))
    .reduce((acc: Record<string, number>, curr) => {
      const match = curr.reference.match(/BLOK\s?(\d+)/i);
      if (match && match[1]) {
        const blok = match[1];
        acc[blok] = (acc[blok] || 0) + curr.quantity;
      }
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all groups">
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {stat.value}{stat.unit && <span className="text-[11px] ml-1 opacity-50 font-bold">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PUS Breakdown Chart - Card Styled from Ref Image */}
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
           <div className="bg-[#064E3B] p-4 flex items-center justify-center">
             <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
               Prestasi Ikut Pusingan (PUS)
             </h3>
           </div>
           
           <div className="p-8 flex flex-col items-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pusData} margin={{ top: 32, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                      labelStyle={{ fontSize: '11px', fontWeight: 900, marginBottom: '4px', color: '#064E3B' }}
                      formatter={(value: any, name: any) => [
                        typeof value === 'number' ? `${value.toLocaleString()} BEG` : value,
                        name
                      ]}
                    />
                    <Bar dataKey="target" radius={[4, 4, 0, 0]} fill="#F1F5F9" barSize={34} name="Sasaran (BEG)" isAnimationActive={false} />
                    <Bar dataKey="actual" radius={[4, 4, 0, 0]} barSize={26} name="Aktual (BEG)" isAnimationActive={false}>
                      <LabelList 
                        dataKey="pct" 
                        position="top" 
                        formatter={(val: any) => `${val}%`}
                        style={{ fontSize: '11px', fontWeight: 900, fill: '#047857' }} 
                      />
                      {pusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Perbandingan sasaran vs pencapaian mengikut pusingan baja tahun 2026.
                </p>
              </div>
           </div>
        </div>

        {/* Category Breakdown - Card Styled from Ref Image */}
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
           <div className="bg-[#064E3B] p-4 flex items-center justify-center">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                Pecapaian Mengikut Kategori
              </h3>
           </div>
           
           <div className="p-8 flex flex-col items-center justify-center h-full">
              <div className="w-full max-w-[240px] aspect-square relative mb-8">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={[
                         { name: 'Compact', value: compactActual || 1 },
                         { name: 'Organic', value: organicActual || 1 }
                       ]}
                       cx="50%"
                       cy="50%"
                       innerRadius={70}
                       outerRadius={95}
                       paddingAngle={8}
                       stroke="none" dataKey="value" isAnimationActive={false}
                     >
                       <Cell fill="#059669" />
                       <Cell fill="#10b981" />
                     </Pie>
                     <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                     />
                   </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-3xl font-black text-[#064E3B] dark:text-emerald-400 leading-none">{overallProgress}%</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-[0.2em]">KESELURUHAN</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                    <span className="text-[9px] font-black text-emerald-900 dark:text-emerald-300 uppercase italic">Compact</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none">{compactProgress}%</p>
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    <span className="text-[9px] font-black text-emerald-900 dark:text-emerald-300 uppercase italic">Organic</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none">{organicProgress}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Pecahan peratusan siap mengikut kategori baja (Compact vs Organik).
                </p>
              </div>
           </div>
        </div>
      </div>

      {/* Integration: Inventory vs Field Progress */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="bg-[#064E3B] p-4 flex items-center justify-between">
          <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <Package size={14} className="text-emerald-400" />
            Hubungan Inventori & Progress Lapangan
          </h3>
          <span className="text-[8px] font-black text-emerald-300 uppercase">Status Keluar Baja</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(blockStockIssued).length > 0 ? (
              Object.entries(blockStockIssued).map(([blok, qty]) => {
                const actualProgress = entriesArray
                  .filter(e => e.blok_code === blok)
                  .reduce((acc, curr) => acc + curr.total_beg_completed, 0);
                const diff = (qty as number) - actualProgress;
                
                return (
                  <div key={blok} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                      <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-black text-xs">
                        {blok}
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Stok Keluar</p>
                        <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{qty as number} BEG</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[8px] font-bold uppercase">
                        <span className="text-slate-500">Tabur Lapangan:</span>
                        <span className="text-emerald-600 font-black">{actualProgress} BEG</span>
                      </div>
                      <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${Math.min(100, (actualProgress / (qty as number)) * 100)}%` }} 
                        />
                      </div>
                      {diff > 0 && (
                        <p className="text-[7px] font-black text-amber-500 uppercase tracking-tighter italic">
                          * Baki {diff.toFixed(1)} BEG belum direkod tabur
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-8 text-center text-slate-400">
                <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                  Tiada rekod keluar baja (BLOK) ditemui dalam transaksi terkini.<br/>
                  <span className="opacity-50">Sila masukkan rujukan "BLOK [NO]" di modul Inventori.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Blocks Card Alternative Layout */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Prestasi Blok Tertinggi</h3>
           <button className="text-[10px] font-black text-purple-500 uppercase hover:underline">Lihat Semua</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {masterArray
              .map(m => {
                const bCode = String(m.blok_code || m.blok || '');
                const actual = entriesArray
                  .filter(e => String(e.blok_code || e.blok || '') === bCode)
                  .reduce((acc, curr) => acc + (Number(curr.total_beg_completed) || 0), 0);
                return { ...m, blok_code: bCode, actual, pct: calculateProgress(actual, m.grand_total_beg) };
              })
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 6)
              .map((block, idx) => {
                const status = getProgressStatus(block.pct);
                return (
                  <div key={idx} className="group relative p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-800 transition-all overflow-hidden">
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center font-black text-xs text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                        {block.blok_code}
                      </div>
                      <div className={`px-2.5 py-1 rounded-full ${status.color} text-white text-[9px] font-black uppercase shadow-lg shadow-black/5`}>
                        {block.pct}%
                      </div>
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none">Blok {block.blok_code}</p>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                          <span>Progress</span>
                          <span>{block.actual} / {block.grand_total_beg} BEG</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${block.pct}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${block.pct > 70 ? 'bg-emerald-500' : block.pct > 30 ? 'bg-purple-500' : 'bg-slate-400'}`}
                          ></motion.div>
                        </div>
                      </div>
                    </div>
                    {/* Abstract background accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full -mr-8 -mt-8 translate-x-4"></div>
                  </div>
                );
              })}
         </div>
      </div>
    </div>
  );
};
