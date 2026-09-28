import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, ChevronDown, ChevronLeft, ChevronRight, Plus, ScanLine, Loader2, Calendar
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis,
  ComposedChart, Tooltip, Bar, Cell, LabelList, Line, PieChart, Pie, Legend, ReferenceLine
} from 'recharts';
import { CHART_COLORS } from '../../../utils/constants';

interface BlockAnalyticsChartsProps {
  thekChartRef?: any;
  showThekChart: boolean;
  setShowThekChart: (val: boolean | ((prev: boolean) => boolean)) => void;
  chartMetric: string;
  thekSortMode: 'blok' | 'desc' | 'asc';
  setThekSortMode: (mode: 'blok' | 'desc' | 'asc') => void;
  chartPeriod: 'day' | 'month' | 'year' | 'history';
  setChartPeriod: (period: 'day' | 'month' | 'year' | 'history') => void;
  reportType: string;
  thekHistoryView: 'overall' | 'pkt1' | 'pkt2' | 'felda';
  setThekHistoryView: (view: 'overall' | 'pkt1' | 'pkt2' | 'felda') => void;
  historyChartData: any[];
  isDarkMode: boolean;
  analytics: any;
  setIsThekExpanded: (val: boolean) => void;
  setIsPieExpanded: (val: boolean) => void;
  currentHasilTab?: string;
  activeKualitiTab?: string;
  dashboardDate?: string;
  setDashboardDate?: (date: string) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

export const BlockAnalyticsCharts: React.FC<BlockAnalyticsChartsProps> = ({
  thekChartRef,
  showThekChart,
  setShowThekChart,
  chartMetric,
  thekSortMode,
  setThekSortMode,
  chartPeriod,
  setChartPeriod,
  reportType,
  thekHistoryView,
  setThekHistoryView,
  historyChartData,
  isDarkMode,
  analytics,
  setIsThekExpanded,
  setIsPieExpanded,
  currentHasilTab = 'kpi',
  activeKualitiTab = 'muda',
  dashboardDate,
  setDashboardDate,
}) => {
  const isVisible =
    (reportType === "hasil" && currentHasilTab === 'analitik') ||
    (reportType !== 'hasil' &&
      reportType !== "harga" &&
      reportType !== "baja" &&
      reportType !== "pruning" &&
      reportType !== "merumput" &&
      (reportType !== "kualiti_bts" || activeKualitiTab !== 'penggredan'));

  if (!isVisible) return null;

  // Active Month Index calculation
  const activeMonthIndex = (() => {
    if (dashboardDate && dashboardDate.length >= 7) {
      const m = parseInt(dashboardDate.split("-")[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) return m;
    }
    return new Date().getMonth() + 1;
  })();

  const currentYear = dashboardDate ? dashboardDate.slice(0, 4) : "2026";
  const activeMonthName = MONTH_NAMES[activeMonthIndex - 1] || "Bulan";

  const handleMonthChange = (mIdx: number) => {
    if (!setDashboardDate) return;
    const mStr = String(mIdx).padStart(2, '0');
    const now = new Date();
    const isCurrentMonth = (now.getMonth() + 1) === mIdx && String(now.getFullYear()) === currentYear;
    const lastDay = new Date(Number(currentYear), mIdx, 0).getDate();
    const dayStr = isCurrentMonth ? String(now.getDate()).padStart(2, '0') : String(lastDay).padStart(2, '0');
    setDashboardDate(`${currentYear}-${mStr}-${dayStr}`);
  };

  return (
    <div
      ref={thekChartRef}
      className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800 relative mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div
        className={`flex justify-between items-center ${
          showThekChart ? "mb-4" : "mb-0"
        }`}
      >
        <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5 pl-1">
          <BarChart3 size={10} className="text-emerald-500" />
          PRESTASI BLOK
          {chartMetric === "yield" ? " (THEK)" : ""} -{" "}
          {chartMetric === "yield"
            ? "CAPAI"
            : chartMetric === "muda"
              ? `BTS MUDA ${chartPeriod === 'month' ? `(${activeMonthName.toUpperCase()} ${currentYear})` : ''}`
              : chartMetric === "efb"
                ? "EFB"
                : "KPG=KPA"}
        </h3>
        <motion.button
          onClick={() => setShowThekChart((prev: boolean) => !prev)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
        >
          <motion.div
            animate={{
              rotate: showThekChart ? 180 : 0,
            }}
          >
            <ChevronDown size={12} className="text-slate-400" />
          </motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {showThekChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3">
              <div className="w-full flex flex-wrap items-center justify-center gap-2 mt-2">
                <div className="flex items-center bg-indigo-500/10 p-1 rounded-full backdrop-blur-sm">
                  <button
                    onClick={() =>
                      setThekSortMode(
                        thekSortMode === "blok"
                          ? "desc"
                          : thekSortMode === "desc"
                            ? "asc"
                            : "blok",
                      )
                    }
                    className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all duration-300 ${
                      thekSortMode !== "blok"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {thekSortMode === "blok"
                      ? "Blok"
                      : thekSortMode === "desc"
                        ? "TINGGI"
                        : "RENDAH"}
                  </button>
                </div>
                <div className="flex bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-full backdrop-blur-sm">
                  {(
                    ["day", "month", "year", "history"] as const
                  )
                    .filter(
                      (p) => p !== "history" || reportType === "hasil",
                    )
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => setChartPeriod(p as any)}
                        className={`px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all duration-300 ${
                          chartPeriod === p
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        {p === "day"
                          ? "HARI INI"
                          : p === "month"
                            ? "BULAN INI"
                            : p === "year"
                              ? "TAHUN (YTD)"
                              : "TREND"}
                      </button>
                    ))}
                </div>

                {/* Ultra-Compact Month Stepper Button - Centered and 30% smaller */}
                {setDashboardDate && (
                  <div className="w-full flex items-center justify-center mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 px-0.5">
                    <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-lg p-0.5 shadow-2xs">
                      {/* Previous Month Button (Click Left) */}
                      <button
                        type="button"
                        onClick={() => {
                          const prevIdx = activeMonthIndex === 1 ? 12 : activeMonthIndex - 1;
                          handleMonthChange(prevIdx);
                          if (chartPeriod !== "month") setChartPeriod("month");
                        }}
                        className="p-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Klik untuk bulan sebelumnya"
                      >
                        <ChevronLeft size={10} />
                      </button>

                      {/* Month Dropdown Button */}
                      <div className="relative flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-md shadow-2xs">
                        <Calendar size={9} className={chartMetric === "muda" ? "text-rose-500 shrink-0" : "text-emerald-500 shrink-0"} />
                        <select
                          value={activeMonthIndex}
                          onChange={(e) => {
                            const mIdx = Number(e.target.value);
                            handleMonthChange(mIdx);
                            if (chartPeriod !== "month") setChartPeriod("month");
                          }}
                          className="text-[8px] font-black bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer tracking-wider uppercase pr-0.5 leading-none"
                          title="Pilih Bulan"
                        >
                          {MONTH_NAMES.map((mName, idx) => (
                            <option key={idx + 1} value={idx + 1} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-[10px]">
                              {mName} {currentYear}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Next Month Button (Click Right) */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = activeMonthIndex === 12 ? 1 : activeMonthIndex + 1;
                          handleMonthChange(nextIdx);
                          if (chartPeriod !== "month") setChartPeriod("month");
                        }}
                        className="p-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Klik untuk bulan seterusnya"
                      >
                        <ChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                )}

                {chartPeriod === "history" && (
                  <div className="flex bg-slate-200/50 dark:bg-slate-800/40 p-1 rounded-full backdrop-blur-sm">
                    {(
                      ["overall", "pkt1", "pkt2", "felda"] as const
                    ).map((v) => (
                      <button
                        key={v}
                        onClick={() => setThekHistoryView(v)}
                        className={`px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all duration-300 ${
                          thekHistoryView === v
                            ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        }`}
                      >
                        {v === "overall" ? "ALL" : v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {chartPeriod === "history" ? (
                <div className="h-56 w-full relative mt-2 flex flex-col">
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                    <Plus size={14} className="text-emerald-500" />
                  </div>
                  {historyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={historyChartData}
                        margin={{
                          top: 20,
                          right: 20,
                          left: -15,
                          bottom: 0,
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="colorTrend"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.4}
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
                          dataKey="year"
                          axisLine={{
                            stroke: isDarkMode
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                          }}
                          tickLine={false}
                          tick={{
                            fontSize: 7,
                            fontWeight: 700,
                            fill: CHART_COLORS.gray,
                          }}
                          dy={5}
                        />
                        <YAxis
                          axisLine={{
                            stroke: isDarkMode
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                          }}
                          tickLine={false}
                          domain={[0, "auto"]}
                          tick={{
                            fontSize: 7,
                            fontWeight: 700,
                            fill: CHART_COLORS.gray,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="yield"
                          name="CAPAI"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorTrend)"
                          strokeWidth={1.5}
                          animationDuration={1000}
                          activeDot={false}
                        >
                          <LabelList
                            dataKey="yield"
                            position="top"
                            offset={6}
                            formatter={(val: number) => val.toFixed(1)}
                            style={{
                              fontSize: "7px",
                              fontWeight: 900,
                              fill: "#10b981",
                              fontFamily: "Inter",
                            }}
                          />
                        </Area>
                        <ReferenceLine
                          y={28}
                          stroke="#f43f5e"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: "TARGET",
                            position: "insideTopRight",
                            fill: "#f43f5e",
                            fontSize: 7,
                            fontWeight: 900,
                            dy: -2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2
                        className="animate-spin text-emerald-500"
                        size={24}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Memproses Data...
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div
                    className="h-56 w-full mt-2 cursor-pointer group relative"
                    onClick={() => setIsThekExpanded(true)}
                  >
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                      <ScanLine size={14} className="text-emerald-500" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const periodData = analytics[chartPeriod];
                        if (!periodData || !periodData.blokStats)
                          return (
                            <div className="flex items-center justify-center h-full text-[10px] font-bold text-slate-400">
                              Memuatkan data...
                            </div>
                          );

                        const chartData = [...periodData.blokStats]
                          .filter((d) => {
                            const val =
                              chartMetric === "yield"
                                ? d.yieldHek
                                : chartMetric === "muda"
                                  ? d.muda
                                  : chartMetric === "efb"
                                    ? d.efb_tan
                                    : d.kpg_match_count;
                            return (
                              !isNaN(val) && !isNaN(parseInt(d.blok))
                            );
                          })
                          .sort((a, b) => {
                            if (
                              thekSortMode === "desc" ||
                              thekSortMode === "asc"
                            ) {
                              const valA =
                                chartMetric === "yield"
                                  ? a.yieldHek
                                  : chartMetric === "muda"
                                    ? a.muda
                                    : chartMetric === "efb"
                                      ? a.efb_tan
                                      : a.kpg_match_count;
                              const valB =
                                chartMetric === "yield"
                                  ? b.yieldHek
                                  : chartMetric === "muda"
                                    ? b.muda
                                    : chartMetric === "efb"
                                      ? b.efb_tan
                                      : b.kpg_match_count;
                              return thekSortMode === "desc"
                                ? valB - valA
                                : valA - valB;
                            }
                            return parseInt(a.blok) - parseInt(b.blok);
                          });

                        if (chartData.length === 0)
                          return (
                            <div className="flex items-center justify-center h-full text-[10px] font-bold text-slate-400">
                              Tiada data untuk dipaparkan.
                            </div>
                          );

                        const values = chartData.map((d) =>
                          chartMetric === "yield"
                            ? d.yieldHek
                            : chartMetric === "muda"
                              ? d.muda
                              : chartMetric === "efb"
                                ? d.efb_tan
                                : d.kpg_match_count,
                        );
                        const maxValue = Math.max(...values);
                        const minValue = Math.min(
                          ...values.filter((v) => v > 0),
                        ); // Only non-zero min

                        return (
                          <ComposedChart
                            data={chartData}
                            margin={{
                              top: 55,
                              right: 10,
                              left: -25,
                              bottom: 0,
                            }}
                          >
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
                              dataKey="blok"
                              interval={0}
                              axisLine={{
                                stroke: isDarkMode
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                              }}
                              tickLine={false}
                              tick={{
                                fontSize: 8,
                                fontWeight: 700,
                                fill: CHART_COLORS.gray,
                              }}
                              dy={5}
                            />
                            <YAxis
                              axisLine={{
                                stroke: isDarkMode
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(0,0,0,0.1)",
                              }}
                              tick={{
                                fontSize: 8,
                                fontWeight: 700,
                                fill: CHART_COLORS.gray,
                              }}
                              domain={[0, "auto"]}
                            />
                            {chartMetric !== "muda" && (
                              <Tooltip
                                cursor={{
                                  fill: isDarkMode
                                    ? "rgba(255,255,255,0.05)"
                                    : "rgba(0,0,0,0.02)",
                                }}
                                content={({ active, payload }) => {
                                  if (
                                    active &&
                                    payload &&
                                    payload.length
                                  ) {
                                    const data = payload[0]?.payload;
                                    if (!data) return null;
                                    const val =
                                      chartMetric === "yield"
                                        ? data.yieldHek
                                        : chartMetric === "muda"
                                          ? data.muda
                                          : chartMetric === "efb"
                                            ? data.efb_tan
                                            : data.kpg_match_count;
                                    const target = data.targetHek;
                                    const unit =
                                      chartMetric === "yield"
                                        ? "T/H"
                                        : chartMetric === "muda"
                                          ? "Bts"
                                          : chartMetric === "efb"
                                            ? "Tan"
                                            : "Resit";
                                    const label =
                                      chartMetric === "yield"
                                        ? "CAPAI"
                                        : chartMetric === "muda"
                                          ? "Muda"
                                          : chartMetric === "efb"
                                            ? "EFB"
                                            : "KPG Match";

                                    const isMax =
                                      val === maxValue && val > 0;
                                    const isMin =
                                      val === minValue && val > 0;

                                    return (
                                      <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-1 gap-4">
                                          <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                            Blok {data.blok}
                                          </p>
                                          {isMax && (
                                            <span className="text-[6px] font-black bg-emerald-500 text-white px-1 rounded">
                                              MAX
                                            </span>
                                          )}
                                          {isMin && (
                                            <span className="text-[6px] font-black bg-rose-500 text-white px-1 rounded">
                                              MIN
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-1.5">
                                            <div
                                              className="w-1.5 h-1.5 rounded-full"
                                              style={{
                                                backgroundColor:
                                                  CHART_COLORS.blue,
                                              }}
                                            />
                                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                              {label}:{" "}
                                              {(val || 0).toFixed(
                                                chartMetric === "yield"
                                                  ? 2
                                                  : 0,
                                              )}{" "}
                                              <span className="text-[8px] font-normal opacity-60">
                                                {unit}
                                              </span>
                                            </p>
                                          </div>
                                          {chartMetric === "yield" && (
                                            <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-1 mt-0.5">
                                              <div
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{
                                                  backgroundColor:
                                                    CHART_COLORS.orange,
                                                }}
                                              />
                                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                Target:{" "}
                                                {(
                                                  target || 0
                                                ).toFixed(2)}{" "}
                                                <span className="text-[8px] font-normal opacity-60">
                                                  T/H
                                                </span>
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            )}
                            <Bar
                              dataKey={
                                chartMetric === "yield"
                                  ? "yieldHek"
                                  : chartMetric === "muda"
                                    ? "muda"
                                    : chartMetric === "efb"
                                      ? "efb_tan"
                                      : "kpg_match_count"
                              }
                              radius={[2, 2, 0, 0]}
                              animationDuration={1200}
                              activeBar={{
                                fillOpacity: 0.8,
                                stroke: isDarkMode ? "#fff" : "#000",
                                strokeWidth: 1,
                              }}
                            >
                              {chartData.map((entry, index) => {
                                const val =
                                  chartMetric === "yield"
                                    ? entry.yieldHek
                                    : chartMetric === "muda"
                                      ? entry.muda
                                      : chartMetric === "efb"
                                        ? entry.efb_tan
                                        : entry.kpg_match_count;
                                let color =
                                  chartMetric === "yield"
                                    ? CHART_COLORS.green
                                    : chartMetric === "muda"
                                      ? "#f43f5e"
                                      : chartMetric === "efb"
                                        ? "#8b5cf6"
                                        : "#0ea5e9";
                                const maxColor =
                                  chartMetric === "yield"
                                    ? "#059669"
                                    : chartMetric === "muda"
                                      ? "#e11d48"
                                      : chartMetric === "efb"
                                        ? "#7c3aed"
                                        : "#0284c7";
                                if (val === maxValue && val > 0)
                                  color = maxColor;
                                if (val === minValue && val > 0)
                                  color = "#e11d48"; // Keep rose for min
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={color}
                                  />
                                );
                              })}
                              <LabelList
                                dataKey={
                                  chartMetric === "yield"
                                    ? "yieldHek"
                                    : chartMetric === "muda"
                                      ? "muda"
                                      : chartMetric === "efb"
                                        ? "efb_tan"
                                        : "kpg_match_count"
                                }
                                content={(props: any) => {
                                  const { x, y, width, value } = props;
                                  if (
                                    value === undefined ||
                                    value === null ||
                                    value <= 0
                                  )
                                    return null;
                                  let text =
                                    chartMetric === "yield"
                                      ? value.toFixed(1)
                                      : chartMetric === "efb"
                                        ? value.toFixed(1)
                                        : value.toString();
                                  if (value === maxValue && value > 0) {
                                    text = `▲ ${text}`;
                                  } else if (
                                    value === minValue &&
                                    value > 0
                                  ) {
                                    text = `▼ ${text}`;
                                  }
                                  return (
                                    <text
                                      x={x + width / 2}
                                      y={y - 6}
                                      fill={
                                        isDarkMode ? "#cbd5e1" : "#475569"
                                      }
                                      fontSize="7px"
                                      fontWeight="900"
                                      fontFamily="monospace"
                                      textAnchor="start"
                                      transform={`rotate(-90, ${x + width / 2}, ${y - 6})`}
                                      dominantBaseline="middle"
                                    >
                                      {text}
                                    </text>
                                  );
                                }}
                              />
                            </Bar>
                            {chartMetric === "yield" && (
                              <Line
                                type="monotone"
                                dataKey="targetHek"
                                stroke="#fbbf24"
                                strokeWidth={3}
                                dot={{
                                  r: 4,
                                  fill: "#fbbf24",
                                  strokeWidth: 0,
                                }}
                                activeDot={{ r: 5 }}
                                strokeDasharray="3 3"
                              />
                            )}
                          </ComposedChart>
                        );
                      })()}
                    </ResponsiveContainer>
                  </div>

                  <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-lg"
                        style={{
                          backgroundColor: CHART_COLORS.green,
                        }}
                      />
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        PENCAPAIAN
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-lg"
                        style={{
                          backgroundColor: CHART_COLORS.orange,
                        }}
                      />
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        SASARAN
                      </span>
                    </div>
                  </div>

                  {/* --- NEW PIE CHART SECTION --- */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-0.5 h-3 bg-indigo-500 rounded-full" />
                      <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                        Pecahan CAPAI
                      </p>
                    </div>
                    <div
                      className="h-48 w-full cursor-pointer group relative"
                      onClick={() => setIsPieExpanded(true)}
                    >
                      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                        <ScanLine size={14} className="text-emerald-500" />
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "PKT 1",
                                value:
                                  analytics.month?.pkt1_tan || 0,
                              },
                              {
                                name: "PKT 2",
                                value:
                                  analytics.month?.pkt2_tan || 0,
                              },
                              {
                                name: "FELDA",
                                value:
                                  analytics.month?.felda_tan || 0,
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                            style={{
                              fontSize: "8px",
                              fontWeight: "900",
                              fill: isDarkMode ? "#cbd5e1" : "#475569",
                            }}
                            isAnimationActive={true}
                            animationBegin={400}
                            animationDuration={1500}
                          >
                            <Cell fill={CHART_COLORS.blue} />
                            <Cell fill={CHART_COLORS.orange} />
                            <Cell fill={CHART_COLORS.green} />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDarkMode
                                ? "#1e293b"
                                : "#ffffff",
                              borderRadius: "8px",
                              border: "none",
                              boxShadow:
                                "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                              padding: "8px",
                            }}
                            itemStyle={{
                              fontSize: "10px",
                              fontWeight: 600,
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={24}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => (
                              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider ml-1.5">
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
