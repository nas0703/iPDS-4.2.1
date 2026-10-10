import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, ChevronDown, Calendar, MousePointerClick } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Bar, LabelList, Line, Legend, Cell
} from 'recharts';

interface MonthlyTrendAnalyticsSectionProps {
  effectiveReportType: string;
  reportType: string;
  currentHasilTab: string;
  showTrendCollapsed: boolean;
  setShowTrendCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  dashboardTrendView: 'overall' | 'pkt1' | 'pkt2' | 'felda';
  setDashboardTrendView: (val: 'overall' | 'pkt1' | 'pkt2' | 'felda') => void;
  analytics: any;
  isDarkMode: boolean;
  dashboardDate?: string;
  setDashboardDate?: (date: string) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

export const MonthlyTrendAnalyticsSection: React.FC<MonthlyTrendAnalyticsSectionProps> = ({
  effectiveReportType,
  reportType,
  currentHasilTab,
  showTrendCollapsed,
  setShowTrendCollapsed,
  dashboardTrendView,
  setDashboardTrendView,
  analytics,
  isDarkMode,
  dashboardDate,
  setDashboardDate,
}) => {
  if (
    !(
      (effectiveReportType === "hasil" && currentHasilTab === 'analitik') ||
      effectiveReportType === "muda" ||
      effectiveReportType === "efb" ||
      effectiveReportType === "kpa_kpg"
    )
  ) {
    return null;
  }

  // Derive active month index (1-12)
  const activeMonthIndex = (() => {
    if (dashboardDate && dashboardDate.length >= 7) {
      const m = parseInt(dashboardDate.split("-")[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) return m;
    }
    return new Date().getMonth() + 1;
  })();

  const currentYear = dashboardDate ? dashboardDate.slice(0, 4) : "2026";

  const handleMonthChange = (mIdx: number) => {
    if (!setDashboardDate) return;
    const mStr = String(mIdx).padStart(2, '0');
    setDashboardDate(`${currentYear}-${mStr}-15`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800 relative mb-4">
      <div className={`flex flex-wrap items-center justify-between gap-2 ${showTrendCollapsed ? "mb-0" : "mb-3"}`}>
        <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5 pl-1">
          <BarChart3 size={10} className="text-emerald-500" />
          {effectiveReportType === "muda"
            ? `Trend Bulanan BTS Muda ${currentYear}`
            : effectiveReportType === "efb"
              ? `Trend Bulanan EFB ${currentYear}`
              : effectiveReportType === "kpa_kpg"
                ? `Trend Bulanan KPA/KPG ${currentYear}`
                : `Trend Bulanan ${currentYear}`}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector Dropdown */}
          {setDashboardDate && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar size={11} className={effectiveReportType === "muda" ? "text-rose-500" : "text-emerald-500"} />
              <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase hidden sm:inline">Pilih Bulan:</span>
              <select
                value={activeMonthIndex}
                onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                className="bg-transparent text-[8.5px] font-black uppercase text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={idx} value={idx + 1} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {idx + 1 === activeMonthIndex ? "✓ " : ""}{mName} {currentYear}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === "hasil" && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/50 dark:border-white/5">
              {(["overall", "pkt1", "pkt2", "felda"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDashboardTrendView(v)}
                  className={`px-2 py-1 text-[7px] font-black rounded-md transition-all ${
                    dashboardTrendView === v
                      ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm border border-slate-200 dark:border-slate-600"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {v === "overall" ? "ALL" : v.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTrendCollapsed((prev: boolean) => !prev)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
            >
              <motion.div
                animate={{
                  rotate: showTrendCollapsed ? 0 : 180,
                }}
              >
                <ChevronDown size={14} className="text-slate-400" />
              </motion.div>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!showTrendCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const dataKey =
                    effectiveReportType === "hasil"
                      ? dashboardTrendView === "overall"
                        ? "yield"
                        : dashboardTrendView === "pkt1"
                          ? "pkt1"
                          : dashboardTrendView === "pkt2"
                            ? "pkt2"
                            : "felda"
                      : effectiveReportType === "muda"
                        ? "muda"
                        : effectiveReportType === "efb"
                          ? "efb"
                          : "kpg";

                  const unit =
                    effectiveReportType === "hasil"
                      ? "T/H"
                      : effectiveReportType === "muda"
                        ? "Bts"
                        : effectiveReportType === "efb"
                          ? "Tan"
                          : "Resit";
                  const label =
                    effectiveReportType === "hasil"
                      ? "CAPAI"
                      : effectiveReportType === "muda"
                        ? "Muda"
                        : effectiveReportType === "efb"
                          ? "EFB"
                          : "KPG Match";

                  return (
                    <ComposedChart
                      data={analytics.monthlyTrend}
                      margin={{ top: 30, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={isDarkMode ? "#334155" : "#e2e8f0"}
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 8,
                          fill: "#64748b",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 8,
                          fill: "#64748b",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label: xLabel }) => {
                          if (!active || !payload || !payload.length) return null;
                          const entry = payload[0]?.payload;
                          if (!entry) return null;

                          if (effectiveReportType === "muda") {
                            const isOngoing = entry.isOngoingMonth && (entry.mudaForecastDelta || 0) > 0;
                            return (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-1.5 text-slate-800 dark:text-slate-100 min-w-[170px]">
                                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                                  {xLabel} {currentYear}
                                </p>
                                <div className="flex justify-between items-center text-[10px] gap-3">
                                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                                    Sebenar Todate ({entry.daysMonitored || 1} Hari):
                                  </span>
                                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                    {entry.muda ?? 0} Bts
                                  </span>
                                </div>
                                {isOngoing && (
                                  <>
                                    <div className="flex justify-between items-center text-[9.5px] gap-3">
                                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                                        Purata Harian:
                                      </span>
                                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {entry.mudaDailyAvg ?? 0} Bts / hari
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] gap-3 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
                                      <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-black">
                                        <span className="w-2 h-2 border border-dashed border-rose-500 bg-rose-500/20 inline-block rounded-xs shrink-0" />
                                        Unjuran Akhir Bulan ({entry.daysInMonth} Hari):
                                      </span>
                                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                        ~{entry.mudaForecast ?? entry.muda} Bts
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-[10px] min-w-[140px] space-y-1">
                              <p className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-0.5">{xLabel} {currentYear}</p>
                              {payload.map((p: any, idx: number) => {
                                let displayLabel = label;
                                if (p.name.includes("target_2026")) displayLabel = "TARGET 2026";
                                else if (p.name.includes("2025")) displayLabel = "CAPAI 2025";
                                else if (p.name === "mudaForecastDelta") return null;
                                return (
                                  <p key={idx} style={{ color: p.color || (isDarkMode ? "#38bdf8" : "#0284c7") }} className="font-mono flex justify-between gap-2">
                                    <span>{displayLabel}:</span>
                                    <span className="font-black">{p.value} {unit}</span>
                                  </p>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey={dataKey}
                        stackId={effectiveReportType === "muda" ? "mudaStack" : undefined}
                        radius={effectiveReportType === "muda" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                        onClick={(entry: any) => {
                          if (entry && entry.monthIndex) {
                            handleMonthChange(entry.monthIndex);
                          }
                        }}
                      >
                        {analytics.monthlyTrend?.map((entry: any, index: number) => {
                          const isSelected = entry.monthIndex === activeMonthIndex;
                          const baseColor =
                            reportType === "hasil"
                              ? "#10b981"
                              : effectiveReportType === "muda"
                                ? "#f43f5e"
                                : "#0ea5e9";
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isSelected ? baseColor : `${baseColor}99`}
                              stroke={isSelected ? (isDarkMode ? "#ffffff" : "#0f172a") : "none"}
                              strokeWidth={isSelected ? 2 : 0}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          );
                        })}
                        {effectiveReportType !== "muda" ? (
                          <LabelList
                            dataKey={dataKey}
                            position="top"
                            style={{
                              fill: isDarkMode ? "#10b981" : "#059669",
                              fontSize: "8px",
                              fontWeight: "bold",
                            }}
                            formatter={(value: any) => (value > 0 ? value : "")}
                          />
                        ) : (
                          <LabelList
                            dataKey="muda"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, height, index } = props;
                              const entry = analytics.monthlyTrend?.[index];
                              if (!entry || entry.muda === null || entry.muda === undefined || entry.muda <= 0) return null;

                              const isOngoing = entry.isOngoingMonth && (entry.mudaForecastDelta || 0) > 0;
                              // For ongoing month, display the actual value on/above the solid bar segment
                              if (isOngoing) {
                                const showInside = height && height >= 14;
                                return (
                                  <text
                                    x={x + width / 2}
                                    y={showInside ? y + 10 : y - 3}
                                    textAnchor="middle"
                                    fill={showInside ? "#ffffff" : (isDarkMode ? "#f43f5e" : "#e11d48")}
                                    fontSize="7.5"
                                    fontWeight="900"
                                    filter={showInside ? "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" : undefined}
                                  >
                                    {entry.muda}
                                  </text>
                                );
                              }

                              // For completed months (Jan-Sep), render actual number above the bar!
                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 4}
                                  textAnchor="middle"
                                  fill={isDarkMode ? "#f43f5e" : "#e11d48"}
                                  fontSize="8"
                                  fontWeight="bold"
                                >
                                  {entry.muda}
                                </text>
                              );
                            }}
                          />
                        )}
                      </Bar>

                      {effectiveReportType === "muda" && (
                        <Bar
                          dataKey="mudaForecastDelta"
                          stackId="mudaStack"
                          radius={[4, 4, 0, 0]}
                          onClick={(entry: any) => {
                            if (entry && entry.monthIndex) {
                              handleMonthChange(entry.monthIndex);
                            }
                          }}
                        >
                          {analytics.monthlyTrend?.map((entry: any, index: number) => {
                            const hasDelta = (entry.mudaForecastDelta || 0) > 0;
                            return (
                              <Cell
                                key={`cell-forecast-${index}`}
                                fill={hasDelta ? "#f43f5e" : "transparent"}
                                fillOpacity={hasDelta ? 0.35 : 0}
                                stroke={hasDelta ? "#f43f5e" : "none"}
                                strokeWidth={hasDelta ? 1.5 : 0}
                                strokeDasharray={hasDelta ? "3 3" : undefined}
                                className="cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            );
                          })}
                          <LabelList
                            dataKey="mudaForecastDelta"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, index, payload } = props;
                              const entry = payload || analytics.monthlyTrend?.[index];
                              if (!entry) return null;

                              const isOngoing = entry.isOngoingMonth && (entry.mudaForecastDelta || 0) > 0;

                              if (isOngoing) {
                                const val = entry.mudaForecast ?? (entry.muda + entry.mudaForecastDelta);
                                return (
                                  <text
                                    x={x + width / 2}
                                    y={y - 4}
                                    textAnchor="middle"
                                    fill={isDarkMode ? "#f43f5e" : "#e11d48"}
                                    fontSize="8"
                                    fontWeight="900"
                                  >
                                    ~{val}
                                  </text>
                                );
                              }

                              return null;
                            }}
                          />
                        </Bar>
                      )}
                      {reportType === "hasil" && (
                        <>
                          <Line
                            type="monotone"
                            dataKey={
                              dashboardTrendView === "overall"
                                ? "t_h2025"
                                : dashboardTrendView === "pkt1"
                                  ? "t_h2025_pkt1"
                                  : dashboardTrendView === "pkt2"
                                    ? "t_h2025_pkt2"
                                    : dashboardTrendView === "felda"
                                      ? "t_h2025_felda"
                                      : "yield2025"
                            }
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey={
                              dashboardTrendView === "overall"
                                ? "target_2026"
                                : dashboardTrendView === "pkt1"
                                  ? "target_2026_pkt1"
                                  : dashboardTrendView === "pkt2"
                                    ? "target_2026_pkt2"
                                    : dashboardTrendView === "felda"
                                      ? "target_2026_felda"
                                      : "target_2026"
                            }
                            stroke="#f43f5e"
                            strokeDasharray="3 3"
                            dot={false}
                            strokeWidth={2}
                          />
                        </>
                      )}
                      <Legend
                        verticalAlign="bottom"
                        height={20}
                        content={() => (
                          <div className="flex justify-center flex-wrap gap-x-4 mt-2">
                            <div className="flex items-center gap-1">
                              <div
                                className={`w-2.5 h-2.5 rounded-sm ${
                                  effectiveReportType === "hasil"
                                    ? "bg-emerald-500"
                                    : effectiveReportType === "muda"
                                      ? "bg-rose-500"
                                      : "bg-sky-500"
                                }`}
                              />
                              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                {reportType === "hasil"
                                  ? "CAPAI 2026"
                                  : effectiveReportType === "muda"
                                    ? "SEBENAR TODATE"
                                    : label.toUpperCase()}
                              </span>
                            </div>
                            {effectiveReportType === "muda" && (
                              <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-xs border border-dashed border-rose-500 bg-rose-500/30" />
                                <span className="text-[7px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest leading-none">
                                  UNJURAN AKHIR BULAN
                                </span>
                              </div>
                            )}
                            {reportType === "hasil" && (
                              <>
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-[1px] bg-slate-400 border-t border-dashed border-slate-400" />
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                    CAPAI 2025
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-[1px] bg-rose-500 border-t border-dashed border-rose-500" />
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                    TARGET 2026
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      />
                    </ComposedChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>

            {setDashboardDate && (
              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1 text-[7.5px] font-semibold text-slate-400 dark:text-slate-500">
                <MousePointerClick size={10} className="text-rose-500 animate-pulse" />
                <span>Tekan mana-mana bar bulan di atas untuk membuat pilihan & analisa laporan bulanan mengikut bulan.</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

