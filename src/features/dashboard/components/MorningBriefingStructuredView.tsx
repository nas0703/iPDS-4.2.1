import React from 'react';

interface StructuredBriefingViewProps {
  structuredData: any;
  reportDate: string;
  getDayCardTitle: (date: string) => string;
}

export const MorningBriefingStructuredView: React.FC<StructuredBriefingViewProps> = ({
  structuredData,
  reportDate,
  getDayCardTitle,
}) => {
  if (!structuredData) return null;

  return (
    <div className="space-y-6">
      {/* Visual Quick Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
            {getDayCardTitle(reportDate)}
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {structuredData.hariIni?.totalTan || '0.00'} <span className="text-xs font-bold text-slate-400">mt</span>
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
            Yield: {structuredData.hariIni?.yieldTH || '0.000'} t/ha ({structuredData.hariIni?.totalResit || 0} Resit)
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 truncate">
            Bulan Ini ({structuredData.bulanLaporan})
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {structuredData.bulanIni?.totalTan || '0.00'} <span className="text-xs font-bold text-slate-400">mt</span>
          </p>
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
            {structuredData.bulanIni?.pencapaianPct || '0%'} dpd target ({structuredData.bulanIni?.sasaranTan || '0'} mt)
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
            Kualiti BTS Muda
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {structuredData.bulanIni?.btsMuda || 0} <span className="text-xs font-bold text-slate-400">Bts</span>
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
            Semalam: {structuredData.hariIni?.btsMuda || 0} Bts | MTD: {structuredData.bulanIni?.btsMudaPct || '0%'}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 truncate">
            KPG = KPA (MTD)
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1 truncate">
            {structuredData.bulanIni?.kpgMatchCount || 0} / {structuredData.bulanIni?.totalResit || 0}{' '}
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              ({structuredData.bulanIni?.kpgMatchPct || '0%'})
            </span>
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
            Semalam: {structuredData.hariIni?.kpgRatioStr || structuredData.hariIni?.kpgMatchPct || '0%'}
          </p>
        </div>
      </div>

      {/* Row 2 Metrics: ABW & Taburan Hujan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 truncate">
            ⚖️ Purata Berat Tandan (ABW)
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {structuredData.bulanIni?.abw || 'N/A'}{' '}
            <span className="text-xs font-bold text-slate-400">MTD</span>
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
            Semalam: {structuredData.hariIni?.abw || 'N/A'} | YTD: {structuredData.tahunIni?.abw || 'N/A'}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-950/20 border border-cyan-500/20">
          <p className="text-[9px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 truncate">
            🌧️ Taburan Hujan & Iklim Lapangan
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {structuredData.hujan?.mtdMm || 0} <span className="text-xs font-bold text-slate-400">mm (MTD)</span>
            <span className="text-xs font-bold text-slate-400 ml-2">| {structuredData.hujan?.ytdMm || 0} mm (YTD)</span>
          </p>
          <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 mt-0.5 truncate">
            {structuredData.hujan?.status || 'Taburan hujan dipantau untuk operasi penuaian dan pembajaan.'}
          </p>
        </div>
      </div>

      {/* Visual Block Analytics Ranking: BTS Muda & KPG=KPA */}
      {(structuredData.top3BtsMudaSemalam || structuredData.top3KpgBulan) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Top 3 BTS Muda Card */}
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-200/50 dark:border-amber-900/30">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                🥭 3 Blok BTS Muda Tertinggi
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                Kawalan Kualiti
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {/* Semalam */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-amber-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase mb-1">Semalam</p>
                <div className="space-y-1 text-[11px] font-bold">
                  {(structuredData.top3BtsMudaSemalam || []).map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {b.blokCode}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">{b.btsMuda} bts</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MTD */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-amber-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase mb-1">MTD</p>
                <div className="space-y-1 text-[11px] font-bold">
                  {(structuredData.top3BtsMudaBulan || []).map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {b.blokCode}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">{b.btsMuda} bts</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* YTD */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-amber-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase mb-1">YTD</p>
                <div className="space-y-1 text-[11px] font-bold">
                  {(structuredData.top3BtsMudaTahun || []).map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {b.blokCode}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-[10px]">{b.btsMuda} bts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top 3 KPG=KPA Card */}
          <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-purple-200/50 dark:border-purple-900/30">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                🎯 3 Blok KPG = KPA Tertinggi
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                Gred Kilang
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* MTD */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-purple-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-purple-700 dark:text-purple-400 uppercase mb-1">Bulan Ini (MTD)</p>
                <div className="space-y-1 text-[11px] font-bold">
                  {(structuredData.top3KpgBulan || []).map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {b.blokCode}</span>
                      <span className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">{b.kpgRatioStr}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* YTD */}
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-purple-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-purple-700 dark:text-purple-400 uppercase mb-1">Tahun Ini (YTD)</p>
                <div className="space-y-1 text-[11px] font-bold">
                  {(structuredData.top3KpgTahun || []).map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {b.blokCode}</span>
                      <span className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">{b.kpgRatioStr}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
