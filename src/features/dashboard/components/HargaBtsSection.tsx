import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, BarChart3, ChevronDown, CircleDollarSign, Share2, Loader2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Brush } from 'recharts';
import { CHART_COLORS } from '../../../utils/constants';

interface HargaBtsSectionProps {
  analytics: any;
  showPriceTrendChart: boolean;
  setShowPriceTrendChart: (val: boolean | ((prev: boolean) => boolean)) => void;
  isDarkMode: boolean;
  handleShareBtsReport: () => void;
  isSharingBts: boolean;
}

export const HargaBtsSection: React.FC<HargaBtsSectionProps> = ({
  analytics,
  showPriceTrendChart,
  setShowPriceTrendChart,
  isDarkMode,
  handleShareBtsReport,
  isSharingBts,
}) => {
  return (
    <div className="space-y-4">
      {/* HARGA BTS CHARTS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col items-center justify-center mb-2 relative">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-500" />
              Trend Pergerakan Harga
            </h3>
          </div>
          <button
            onClick={() => setShowPriceTrendChart((prev: boolean) => !prev)}
            className="absolute right-0 top-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
          >
            <motion.div
              animate={{
                rotate: showPriceTrendChart ? 180 : 0,
              }}
            >
              <ChevronDown size={12} className="text-slate-400" />
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {showPriceTrendChart && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-4 mt-2">
                {/* Daily Price Movement Chart (Monthly View) */}
                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
                  <div className="bg-[#064E3B] px-3 py-2 flex items-center justify-between">
                    <h3 className="text-[8px] font-black text-emerald-100 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={12} className="text-emerald-400" />
                      Analisis Harian (Bulan Semasa)
                    </h3>
                    <div className="px-2 py-0.5 bg-black/20 rounded-lg border border-white/10">
                      <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">
                        RM / TAN
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="h-40 w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analytics.dailyPriceTrend}
                          margin={{
                            top: 10,
                            right: 10,
                            left: -20,
                            bottom: 20,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="colorPriceDaily"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={
                              isDarkMode
                                ? CHART_COLORS.gridDark
                                : CHART_COLORS.grid
                            }
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(str) => str.split("-")[2]}
                            tick={{
                              fontSize: 8,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{
                              fontSize: 8,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                            axisLine={false}
                            tickLine={false}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode
                                ? "#1e293b"
                                : "#ffffff",
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                            }}
                            labelStyle={{
                              fontWeight: 800,
                              fontSize: "10px",
                              marginBottom: "4px",
                              color: "#064E3B",
                            }}
                            itemStyle={{
                              fontSize: "10px",
                              fontWeight: 600,
                            }}
                            formatter={(value: any) => [
                              `RM ${parseFloat(value).toFixed(2)}`,
                              "Harga/Tan",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgPrice"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPriceDaily)"
                            animationDuration={1500}
                          />
                          <Brush
                            dataKey="date"
                            height={15}
                            stroke="#10b981"
                            fill={isDarkMode ? "#0f172a" : "#f8fafc"}
                            startIndex={Math.max(
                              0,
                              (analytics.dailyPriceTrend?.length || 0) - 14,
                            )}
                            tickFormatter={(str) => str.split("-")[2]}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">
                        Pergerakan harga bts harian bagi bulan semasa.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monthly Price Trend Chart (Yearly View) */}
                <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
                  <div className="bg-[#064E3B] px-3 py-2 flex items-center justify-between">
                    <h3 className="text-[8px] font-black text-emerald-100 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={12} className="text-emerald-400" />
                      Trend Bulanan (Tahunan)
                    </h3>
                    <div className="px-2 py-0.5 bg-black/20 rounded-lg border border-white/10">
                      <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">
                        PURATA RM / TAN
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="h-40 w-full mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analytics.monthlyTrend}
                          margin={{
                            top: 10,
                            right: 10,
                            left: -25,
                            bottom: 20,
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="colorPriceMonthly"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#059669"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#059669"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={
                              isDarkMode
                                ? CHART_COLORS.gridDark
                                : CHART_COLORS.grid
                            }
                          />
                          <XAxis
                            dataKey="month"
                            tick={{
                              fontSize: 7,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{
                              fontSize: 7,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                            axisLine={false}
                            tickLine={false}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode
                                ? "#1e293b"
                                : "#ffffff",
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                              padding: "6px",
                            }}
                            labelStyle={{
                              fontWeight: 800,
                              fontSize: "8px",
                              marginBottom: "2px",
                              color: "#064E3B",
                            }}
                            itemStyle={{
                              fontSize: "8px",
                              fontWeight: 600,
                            }}
                            formatter={(value: any) => [
                              `RM ${parseFloat(value).toFixed(2)}`,
                              "Purata Harga",
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="avgPrice"
                            stroke="#059669"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#colorPriceMonthly)"
                            animationDuration={1500}
                          />
                          <Brush
                            dataKey="month"
                            height={12}
                            stroke="#059669"
                            fill={isDarkMode ? "#0f172a" : "#f8fafc"}
                            travellerWidth={4}
                            startIndex={0}
                            endIndex={11}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">
                        Purata harga bts harian bagi tahun 2026.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        id="laporan-harga-bts"
        className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3 relative z-10 gap-2 pr-1">
          <div className="flex flex-1 items-center justify-center gap-2 pl-8">
            <CircleDollarSign size={14} className="text-emerald-500" />
            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest text-center">
              Laporan Harga Bts
            </h3>
          </div>
          <button
            onClick={handleShareBtsReport}
            disabled={isSharingBts}
            className="share-bts-btn text-emerald-500 hover:text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 p-1.5 rounded-full transition-colors flex-shrink-0 flex items-center justify-center"
            title="Kongsi ke WhatsApp"
          >
            {isSharingBts ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Share2 size={13} />
            )}
          </button>
        </div>

        {/* Month Header Above Table Headers */}
        {analytics.dailyPriceStats &&
          analytics.dailyPriceStats.length > 0 &&
          (() => {
            const firstRow = analytics.dailyPriceStats[0];
            const [year, month] = firstRow.date.split("-");
            const monthNames = [
              "Januari",
              "Februari",
              "Mac",
              "April",
              "Mei",
              "Jun",
              "Julai",
              "Ogos",
              "September",
              "Oktober",
              "November",
              "Disember",
            ];
            const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
            return (
              <div className="px-2 py-2 mb-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center">
                  {monthLabel}
                </p>
              </div>
            );
          })()}

        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 w-full custom-scrollbar pb-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                  Tarikh
                </th>
                <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right whitespace-nowrap">
                  Harga 1%
                </th>
                <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right whitespace-nowrap">
                  Harga/Tan
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.dailyPriceStats &&
              analytics.dailyPriceStats.length > 0 ? (
                analytics.dailyPriceStats.map((row: any, idx: number) => {
                  const currentMonth = row.date.slice(0, 7);
                  const prevMonth =
                    idx > 0
                      ? analytics.dailyPriceStats[idx - 1].date.slice(0, 7)
                      : null;
                  const showMonthHeader =
                    currentMonth !== prevMonth && idx > 0;

                  const monthNames = [
                    "Januari",
                    "Februari",
                    "Mac",
                    "April",
                    "Mei",
                    "Jun",
                    "Julai",
                    "Ogos",
                    "September",
                    "Oktober",
                    "November",
                    "Disember",
                  ];
                  const [year, month] = currentMonth.split("-");
                  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

                  return (
                    <React.Fragment key={idx}>
                      {showMonthHeader && (
                        <tr
                          className="bg-slate-100/50 dark:bg-slate-800/80"
                          data-month={currentMonth}
                        >
                          <td
                            colSpan={3}
                            className="p-2 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700"
                          >
                            {monthLabel}
                          </td>
                        </tr>
                      )}
                      <tr
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        data-month={currentMonth}
                      >
                        <td className="p-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/50">
                          {parseInt(row.date.split("-")[2])} hb
                        </td>
                        <td className="p-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 text-right border-b border-slate-50 dark:border-slate-800/50">
                          RM {row.price1Pct.toFixed(2)}
                        </td>
                        <td className="p-2 text-[10px] font-black text-slate-900 dark:text-white text-right border-b border-slate-50 dark:border-slate-800/50">
                          RM {(row.price1Pct * 21.25).toFixed(2)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-[10px] font-bold text-slate-400 italic"
                  >
                    Tiada data harga tersedia
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
