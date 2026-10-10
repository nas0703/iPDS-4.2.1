import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  X,
  Loader2,
} from "lucide-react";
import { CHART_COLORS } from "../../../utils/constants";

interface ExpandedChartModalsProps {
  expandedTrendChart: "overall" | "pkt1" | "pkt2" | "felda" | null;
  setExpandedTrendChart: (val: "overall" | "pkt1" | "pkt2" | "felda" | null) => void;
  reportType: string;
  analytics: any;
  isDarkMode: boolean;
  isThekExpanded: boolean;
  setIsThekExpanded: (val: boolean) => void;
  chartMetric: "yield" | "muda" | "kpg" | "efb";
  chartPeriod: "day" | "month" | "year" | "history" | "monthly_trend";
  isPieExpanded: boolean;
  setIsPieExpanded: (val: boolean) => void;
  isHistoryExpanded: boolean;
  setIsHistoryExpanded: (val: boolean) => void;
  historyChartData: Array<{ year: number; yield: number }>;
}

export function ExpandedChartModals({
  expandedTrendChart,
  setExpandedTrendChart,
  reportType,
  analytics,
  isDarkMode,
  isThekExpanded,
  setIsThekExpanded,
  chartMetric,
  chartPeriod,
  isPieExpanded,
  setIsPieExpanded,
  isHistoryExpanded,
  setIsHistoryExpanded,
  historyChartData,
}: ExpandedChartModalsProps) {
  return (
    <>
      {/* MODAL: CARTA TREND DIPERBESARKAN */}
      {expandedTrendChart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            onClick={() => setExpandedTrendChart(null)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
          />
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-all transform scale-100"
          >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        expandedTrendChart === "overall"
                          ? "bg-emerald-500"
                          : expandedTrendChart === "pkt1"
                            ? "bg-blue-500"
                            : expandedTrendChart === "pkt2"
                              ? "bg-amber-500"
                              : "bg-slate-500"
                      }`}
                    />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                      Trend CAPAI:{" "}
                      {expandedTrendChart === "overall"
                        ? "Purata Keseluruhan"
                        : expandedTrendChart === "pkt1"
                          ? "Peringkat 1"
                          : expandedTrendChart === "pkt2"
                            ? "Peringkat 2"
                            : "Lot Felda"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setExpandedTrendChart(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const dataKey =
                        reportType === "hasil"
                          ? expandedTrendChart === "overall"
                            ? "yield"
                            : expandedTrendChart === "pkt1"
                              ? "pkt1"
                              : expandedTrendChart === "pkt2"
                                ? "pkt2"
                                : "felda"
                          : reportType === "muda"
                            ? expandedTrendChart === "overall"
                              ? "muda"
                              : expandedTrendChart === "pkt1"
                                ? "pkt1Muda"
                                : expandedTrendChart === "pkt2"
                                  ? "pkt2Muda"
                                  : "feldaMuda"
                            : expandedTrendChart === "overall"
                              ? "kpg"
                              : expandedTrendChart === "pkt1"
                                ? "pkt1Kpg"
                                : expandedTrendChart === "pkt2"
                                  ? "pkt2Kpg"
                                  : "feldaKpg";
                      const vals = (analytics?.monthlyTrend || []).map(
                        (d: any) => (d as any)[dataKey],
                      );
                      const max = Math.max(...vals);
                      const min = Math.min(...vals.filter((v: number) => v > 0));
                      const baseColor =
                        reportType === "hasil"
                          ? expandedTrendChart === "overall"
                            ? "#10b981"
                            : expandedTrendChart === "pkt1"
                              ? "#3b82f6"
                              : expandedTrendChart === "pkt2"
                                ? "#f59e0b"
                                : "#64748b"
                          : reportType === "muda"
                            ? "#f43f5e"
                            : "#0ea5e9";
                      const maxColor =
                        reportType === "hasil"
                          ? expandedTrendChart === "overall"
                            ? "#059669"
                            : expandedTrendChart === "pkt1"
                              ? "#2563eb"
                              : expandedTrendChart === "pkt2"
                                ? "#d97706"
                                : "#475569"
                          : reportType === "muda"
                            ? "#e11d48"
                            : "#0284c7";

                      return (
                        <BarChart
                          data={analytics?.monthlyTrend || []}
                          margin={{ top: 30, right: 10, left: -20, bottom: 0 }}
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
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 10,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 10,
                              fontWeight: 700,
                              fill: CHART_COLORS.gray,
                            }}
                          />
                          {reportType === "muda" ? (
                            <Tooltip
                              content={({ active, payload, label: xLabel }) => {
                                if (!active || !payload || !payload.length) return null;
                                const entry = payload[0]?.payload;
                                if (!entry) return null;
                                const isOngoing = entry.isOngoingMonth && (entry.mudaForecastDelta || 0) > 0;
                                return (
                                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-2 text-slate-800 dark:text-slate-100 min-w-[200px]">
                                    <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                                      {xLabel} 2026
                                    </p>
                                    <div className="flex justify-between items-center text-xs gap-3">
                                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                                        Sebenar Todate ({entry.daysMonitored || 1} Hari):
                                      </span>
                                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                        {entry[dataKey] ?? 0} Bts
                                      </span>
                                    </div>
                                    {isOngoing && (
                                      <>
                                        <div className="flex justify-between items-center text-[11px] gap-3">
                                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                                            Purata Harian:
                                          </span>
                                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                            {entry.mudaDailyAvg ?? 0} Bts / hari
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs gap-3 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-800">
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
                              }}
                            />
                          ) : (
                            <Tooltip
                              cursor={{
                                fill: isDarkMode
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.02)",
                              }}
                              contentStyle={{
                                backgroundColor: isDarkMode
                                  ? "#1e293b"
                                  : "#ffffff",
                                borderRadius: "16px",
                                border: "none",
                                boxShadow:
                                  "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                              }}
                              labelStyle={{
                                fontSize: "12px",
                                fontWeight: 800,
                                color: isDarkMode ? "#fff" : "#1e293b",
                                marginBottom: "4px",
                              }}
                              formatter={(value: any) => {
                                const unit =
                                  reportType === "hasil"
                                    ? "T/H"
                                    : "Resit";
                                const label =
                                  reportType === "hasil"
                                    ? "CAPAI"
                                    : "KPG Match";
                                const val =
                                  reportType === "hasil"
                                    ? parseFloat(value).toFixed(2)
                                    : value;
                                return [`${val} ${unit}`, label];
                              }}
                            />
                          )}
                          <Bar
                            dataKey={dataKey}
                            stackId={reportType === "muda" ? "mudaExpandedStack" : undefined}
                            radius={reportType === "muda" ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                            animationDuration={1000}
                          >
                            {(analytics?.monthlyTrend || []).map((entry: any, index: number) => {
                              const val = (entry as any)[dataKey];
                              let color = baseColor;
                              if (val === max && val > 0) color = maxColor;
                              if (val === min && val > 0) color = "#e11d48";
                              return (
                                <Cell key={`cell-${index}`} fill={color} />
                              );
                            })}
                            {reportType !== "muda" ? (
                              <LabelList
                                dataKey={dataKey}
                                position="top"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "900",
                                  fill: isDarkMode ? "#94a3b8" : "#64748b",
                                }}
                                formatter={(val: number) => {
                                  if (val === 0) return "";
                                  let text =
                                    reportType === "hasil"
                                      ? val.toFixed(1)
                                      : val.toString();
                                  if (val === max) return `▲ MAX ${text}`;
                                  if (val === min) return `▼ MIN ${text}`;
                                  return text;
                                }}
                              />
                            ) : (
                              <LabelList
                                dataKey="muda"
                                position="top"
                                content={(props: any) => {
                                  const { x, y, width, height, index } = props;
                                  const entry = analytics?.monthlyTrend?.[index];
                                  if (!entry || entry.muda === null || entry.muda === undefined || entry.muda <= 0) return null;

                                  const isOngoing = entry.isOngoingMonth && (entry.mudaForecastDelta || 0) > 0;
                                  if (isOngoing) {
                                    const showInside = height && height >= 14;
                                    return (
                                      <text
                                        x={x + width / 2}
                                        y={showInside ? y + 11 : y - 3}
                                        textAnchor="middle"
                                        fill={showInside ? "#ffffff" : (isDarkMode ? "#f43f5e" : "#e11d48")}
                                        fontSize="8.5"
                                        fontWeight="900"
                                        filter={showInside ? "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" : undefined}
                                      >
                                        {entry.muda}
                                      </text>
                                    );
                                  }

                                  return (
                                    <text
                                      x={x + width / 2}
                                      y={y - 4}
                                      textAnchor="middle"
                                      fill={isDarkMode ? "#f43f5e" : "#e11d48"}
                                      fontSize="9"
                                      fontWeight="bold"
                                    >
                                      {entry.muda}
                                    </text>
                                  );
                                }}
                              />
                            )}
                          </Bar>
                          {reportType === "muda" && (
                            <Bar
                              dataKey="mudaForecastDelta"
                              stackId="mudaExpandedStack"
                              radius={[6, 6, 0, 0]}
                            >
                              {(analytics?.monthlyTrend || []).map((entry: any, index: number) => {
                                const hasDelta = (entry.mudaForecastDelta || 0) > 0;
                                return (
                                  <Cell
                                    key={`cell-forecast-exp-${index}`}
                                    fill={hasDelta ? "#f43f5e" : "transparent"}
                                    fillOpacity={hasDelta ? 0.35 : 0}
                                    stroke={hasDelta ? "#f43f5e" : "none"}
                                    strokeWidth={hasDelta ? 1.5 : 0}
                                    strokeDasharray={hasDelta ? "3 3" : undefined}
                                  />
                                );
                              })}
                              <LabelList
                                dataKey="mudaForecastDelta"
                                position="top"
                                content={(props: any) => {
                                  const { x, y, width, index, payload } = props;
                                  const entry = payload || analytics?.monthlyTrend?.[index];
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
                                        fontSize="9"
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
                            <ReferenceLine
                              y={2.33}
                              stroke="#f47738"
                              strokeDasharray="3 3"
                              label={{
                                value: "Target",
                                position: "right",
                                fill: "#f47738",
                                fontSize: 10,
                                fontWeight: 900,
                              }}
                            />
                          )}
                        </BarChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    Analisis trend bulanan menunjukkan prestasi{" "}
                    {reportType === "hasil" ? "hasil (Tan/Hektar)" : reportType === "muda" ? "BTS Muda (Bts)" : reportType === "efb" ? "EFB (Tan)" : "KPA/KPG (Resit)"}{" "}
                    bagi tahun {new Date().getFullYear()}.
                    {reportType === "hasil" && " Garis jingga putus-putus mewakili sasaran bulanan (2.33 T/H)."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* MODAL EXPANDED THEK CHART */}
      {isThekExpanded && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            onClick={() => setIsThekExpanded(false)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity"
          />
          <div
            className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] transition-all transform scale-100"
          >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <BarChart3 size={24} className="text-emerald-500" />
                    </div>
                    Analisis THEK:{" "}
                    {chartMetric === "yield"
                      ? "CAPAI"
                      : chartMetric === "muda"
                        ? "Muda"
                        : chartMetric === "efb"
                          ? "EFB"
                          : "KPG Match"}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">
                    Tempoh:{" "}
                    {chartPeriod === "day"
                      ? "HARI INI"
                      : chartPeriod === "month"
                        ? "BULAN INI"
                        : chartPeriod === "year"
                          ? "TAHUN INI"
                          : "Trend Sejarah"}
                  </p>
                </div>
                <button
                  onClick={() => setIsThekExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="h-full w-full min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const periodData = analytics?.[chartPeriod];
                      if (!periodData || !periodData.blokStats) return <div />;

                      const chartData = [...periodData.blokStats]
                        .filter((d) => {
                          const val =
                            chartMetric === "yield"
                              ? d.yieldHek
                              : chartMetric === "muda"
                                ? d.muda
                                : d.kpg_match_count;
                          return !isNaN(val) && !isNaN(parseInt(d.blok));
                        })
                        .sort((a, b) => parseInt(a.blok) - parseInt(b.blok));

                      const values = chartData.map((d) =>
                        chartMetric === "yield"
                          ? d.yieldHek
                          : chartMetric === "muda"
                            ? d.muda
                            : d.kpg_match_count,
                      );
                      const maxValue = Math.max(...values);
                      const minValue = Math.min(...values.filter((v) => v > 0));

                      return (
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 65, right: 20, left: 0, bottom: 20 }}
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
                              fontSize: 12,
                              fontWeight: 800,
                              fill: CHART_COLORS.gray,
                            }}
                            dy={10}
                            label={{
                              value: "NOMBOR BLOK",
                              position: "insideBottom",
                              offset: -10,
                              fontSize: 10,
                              fontWeight: 900,
                              fill: CHART_COLORS.gray,
                            }}
                          />
                          <YAxis
                            axisLine={{
                              stroke: isDarkMode
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.1)",
                            }}
                            tickLine={false}
                            tick={{
                              fontSize: 12,
                              fontWeight: 800,
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
                                if (active && payload && payload.length) {
                                  const data = payload[0]?.payload;
                                  if (!data) return null;
                                  const val =
                                    chartMetric === "yield"
                                      ? data.yieldHek
                                      : (chartMetric as string) === "efb"
                                        ? data.efb_tan
                                        : data.kpg_match_count;
                                  const target = data.targetHek;
                                  const unit =
                                    chartMetric === "yield"
                                      ? "T/H"
                                      : (chartMetric as string) === "efb"
                                        ? "Tan"
                                        : "Resit";
                                  const label =
                                    chartMetric === "yield"
                                      ? "CAPAI"
                                      : (chartMetric as string) === "efb"
                                        ? "EFB"
                                        : "KPG Match";

                                  const isMax = val === maxValue && val > 0;
                                  const isMin = val === minValue && val > 0;

                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 min-w-[200px]">
                                      <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <div className="flex flex-col">
                                          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                            Blok {data.blok}
                                          </p>
                                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                                            PKT{" "}
                                            {data.pkt === "001"
                                              ? "1"
                                              : data.pkt === "002"
                                                ? "2"
                                                : "FELDA"}
                                          </span>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                          {isMax && (
                                            <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                                              TERTINGGI (MAX)
                                            </span>
                                          )}
                                          {isMin && (
                                            <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                                              TERENDAH (MIN)
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                            {label}
                                          </p>
                                          <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                              {(val || 0).toFixed(
                                                chartMetric === "yield" ? 2 : 0,
                                              )}
                                            </p>
                                            <p className="text-xs font-bold text-slate-400 uppercase">
                                              {unit}
                                            </p>
                                          </div>
                                        </div>
                                        {chartMetric === "yield" && (
                                          <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                              Sasaran
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                              <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                                                {(target || 0).toFixed(2)}
                                              </p>
                                              <p className="text-xs font-bold text-slate-400 uppercase">
                                                T/H
                                              </p>
                                            </div>
                                            <div className="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full transition-all duration-1000 ${val >= target ? "bg-emerald-500" : "bg-amber-500"}`}
                                                style={{
                                                  width: `${Math.min(100, (val / (target || 1)) * 100)}%`,
                                                }}
                                              />
                                            </div>
                                            <p className="text-[10px] font-black text-right mt-1 text-slate-500 uppercase tracking-widest">
                                              {(
                                                (val / (target || 1)) *
                                                100
                                              ).toFixed(0)}
                                              % Capai
                                            </p>
                                          </div>
                                        )}
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">
                                              Luas
                                            </p>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                                              {data.luas} Ha
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">
                                              Resit
                                            </p>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                                              {data.resit_count}
                                            </p>
                                          </div>
                                        </div>
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
                            radius={[6, 6, 0, 0]}
                            animationDuration={1500}
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
                              if (val === maxValue && val > 0) color = maxColor;
                              if (val === minValue && val > 0)
                                color = "#e11d48";
                              return (
                                <Cell key={`cell-${index}`} fill={color} />
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
                                if (value === undefined || value === null || value <= 0) return null;
                                let text =
                                  chartMetric === "yield"
                                    ? value.toFixed(2)
                                    : chartMetric === "efb"
                                      ? value.toFixed(1)
                                      : value.toString();
                                if (value === maxValue && value > 0) {
                                  text = `▲ MAX ${text}`;
                                } else if (value === minValue && value > 0) {
                                  text = `▼ MIN ${text}`;
                                }
                                return (
                                  <text
                                    x={x + width / 2}
                                    y={y - 8}
                                    fill={isDarkMode ? "#f8fafc" : "#0f172a"}
                                    fontSize="10px"
                                    fontWeight="900"
                                    fontFamily="monospace"
                                    textAnchor="start"
                                    transform={`rotate(-90, ${x + width / 2}, ${y - 8})`}
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
                              stroke={CHART_COLORS.orange}
                              strokeWidth={4}
                              dot={{
                                r: 6,
                                fill: CHART_COLORS.orange,
                                strokeWidth: 0,
                              }}
                              activeDot={{ r: 8, strokeWidth: 0 }}
                            />
                          )}
                        </ComposedChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-8">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shadow-lg"
                    style={{ backgroundColor: CHART_COLORS.green }}
                  />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Pencapaian Sebenar
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shadow-lg"
                    style={{ backgroundColor: CHART_COLORS.orange }}
                  />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    Sasaran (Target)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* MODAL EXPANDED PIE CHART */}
      {isPieExpanded && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            onClick={() => setIsPieExpanded(false)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity"
          />
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col transition-all transform scale-100"
          >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                      <PieChartIcon size={24} className="text-indigo-500" />
                    </div>
                    Pecahan CAPAI Mengikut Peringkat
                  </h3>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">
                    Analisis Komposisi Pengeluaran
                  </p>
                </div>
                <button
                  onClick={() => setIsPieExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "PKT 1",
                            value: analytics?.month?.pkt1_tan || 0,
                          },
                          {
                            name: "PKT 2",
                            value: analytics?.month?.pkt2_tan || 0,
                          },
                          {
                            name: "FELDA",
                            value: analytics?.month?.felda_tan || 0,
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        isAnimationActive={true}
                        animationBegin={200}
                        animationDuration={1500}
                      >
                        <Cell fill={CHART_COLORS.blue} />
                        <Cell fill={CHART_COLORS.orange} />
                        <Cell fill={CHART_COLORS.green} />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                          padding: "12px",
                        }}
                        itemStyle={{ fontSize: "14px", fontWeight: 700 }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => (
                          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-2">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-6 w-full">
                  {[
                    {
                      label: "PKT 1",
                      val: analytics?.month?.pkt1_tan || 0,
                      color: CHART_COLORS.blue,
                    },
                    {
                      label: "PKT 2",
                      val: analytics?.month?.pkt2_tan || 0,
                      color: CHART_COLORS.orange,
                    },
                    {
                      label: "FELDA",
                      val: analytics?.month?.felda_tan || 0,
                      color: CHART_COLORS.green,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center"
                    >
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {item.label}
                      </p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">
                        {item.val.toFixed(2)}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">
                        Tan
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* MODAL EXPANDED HISTORY CHART */}
      {isHistoryExpanded && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            onClick={() => setIsHistoryExpanded(false)}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md transition-opacity"
          />
          <div
            className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] transition-all transform scale-100"
          >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <TrendingUp size={24} className="text-emerald-500" />
                    </div>
                    Trend CAPAI Sejarah (Tahunan)
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">
                    Analisis Prestasi Jangka Panjang
                  </p>
                </div>
                <button
                  onClick={() => setIsHistoryExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-8 overflow-hidden flex flex-col">
                <div className="h-full w-full min-h-[400px]">
                  {historyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={historyChartData}
                        margin={{ top: 40, right: 30, left: 0, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorHistoryFull"
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
                            fontSize: 14,
                            fontWeight: 800,
                            fill: CHART_COLORS.gray,
                          }}
                          dy={15}
                        />
                        <YAxis
                          axisLine={{
                            stroke: isDarkMode
                              ? "rgba(255,255,255,0.1)"
                              : "rgba(0,0,0,0.1)",
                          }}
                          tickLine={false}
                          tick={{
                            fontSize: 14,
                            fontWeight: 800,
                            fill: CHART_COLORS.gray,
                          }}
                          domain={[0, "auto"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="yield"
                          stroke="#10b981"
                          strokeWidth={5}
                          fillOpacity={1}
                          fill="url(#colorHistoryFull)"
                          animationDuration={1000}
                          activeDot={false}
                        >
                          <LabelList
                            dataKey="yield"
                            position="top"
                            offset={15}
                            formatter={(val: number) => val.toFixed(2)}
                            style={{
                              fontSize: "12px",
                              fontWeight: 900,
                              fill: "#10b981",
                              fontFamily: "Inter",
                            }}
                          />
                        </Area>
                        <ReferenceLine
                          y={28}
                          stroke="#f43f5e"
                          strokeDasharray="10 10"
                          strokeWidth={3}
                          label={{
                            value: "SASARAN (28 T/H)",
                            position: "insideTopRight",
                            fill: "#f43f5e",
                            fontSize: 14,
                            fontWeight: 900,
                            dy: -20,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                      <Loader2
                        className="animate-spin text-emerald-500"
                        size={60}
                      />
                      <div className="text-center space-y-2">
                        <h4 className="text-slate-400 font-black uppercase tracking-[0.3em] text-xl">
                          Menyusun Data Sejarah
                        </h4>
                        <p className="text-slate-500 font-bold text-sm">
                          Sila tunggu sebentar sementara sistem memproses trend
                          prestasi 2012–2025...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full shadow-xl"
                    style={{ backgroundColor: "#10b981" }}
                  />
                  <span className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em]">
                    CAPAI Tahunan (Tan/Hektar)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
