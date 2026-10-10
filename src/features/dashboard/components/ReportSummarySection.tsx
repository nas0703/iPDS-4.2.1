import React from "react";
import { Calendar, Target, TrendingUp, TrendingDown } from "lucide-react";
import { MASTER_DATA, MONTHLY_TARGETS_2026, CHART_COLORS } from "../../../utils/constants";
import { getActiveEstateConfig } from "../../../utils/estateContext";
import { AnimatePresence, motion } from "motion/react";
import { PieChart, Pie, ResponsiveContainer } from "recharts";

export const ReportSummarySection = ({
  type,
  data,
  period,
  isDarkMode,
  mode = "all",
  scope = "estet",
  onToggleScope,
}: {
  type: string;
  data: any /* fix unknown */;
  period: "day" | "month" | "year";
  isDarkMode: boolean;
  mode?:
    | "hero"
    | "details"
    | "all"
    | "details-pkt1"
    | "details-pkt2"
    | "details-felda"
    | "details-tambahan";
  scope?: "estet" | "all";
  onToggleScope?: (s: "estet" | "all") => void;
}) => {
  if (!data) return null;

  const estateConfig = getActiveEstateConfig();
  const isTunggal = estateConfig?.id === "FPM_TUNGGAL";
  const currentMasterData = estateConfig?.blocks && Object.keys(estateConfig.blocks).length > 0
    ? estateConfig.blocks
    : (isTunggal ? MASTER_DATA : {});
  const currentMonthlyTargets = estateConfig?.monthlyTargets2026 && Object.keys(estateConfig.monthlyTargets2026).length > 0
    ? estateConfig.monthlyTargets2026
    : (isTunggal ? MONTHLY_TARGETS_2026 : {});

  const getTargetHek = (pkt: string) => {
    const targets = currentMonthlyTargets[pkt] || [];
    const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    const currentMonthIdx = now.getMonth();
    const currentDay = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      currentMonthIdx + 1,
      0,
    ).getDate();

    if (period === "day") {
      const monthTarget = targets[currentMonthIdx] || 0;
      return monthTarget / daysInMonth;
    }
    if (period === "month") {
      return targets[currentMonthIdx] || 0;
    }
    if (period === "year") {
      // Seasonal Cumulative Target (YTD)
      const sumPrevMonths = targets
        .slice(0, currentMonthIdx)
        .reduce((a, b) => a + b, 0);
      const partialCurrentMonth =
        (targets[currentMonthIdx] || 0) * (currentDay / daysInMonth);
      return sumPrevMonths + partialCurrentMonth;
    }
    return targets.reduce((a, b) => a + b, 0);
  };

  const targetPkt1 = getTargetHek("001");
  const targetPkt2 = getTargetHek("002");
  const targetFelda = getTargetHek("003");
  const targetTambahan = getTargetHek("004");

  // Calculate specific luas for each peringkat for higher accuracy based on active estate
  const luasPkt1 = Object.values(currentMasterData)
    .filter((b) => b.pkt === "001")
    .reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);
  const luasPkt2 = Object.values(currentMasterData)
    .filter((b) => b.pkt === "002")
    .reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);
  const luasFelda = Object.values(currentMasterData)
    .filter((b) => b.pkt === "003")
    .reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);
  const luasTambahan = Object.values(currentMasterData)
    .filter((b) => b.pkt === "004")
    .reduce((acc, curr) => acc + (Number(curr.luas) || 0), 0);

  // 1. Skop Pilihan A: Estet Utama (Pkt 1 & 2 sahaja)
  const luasEstet = luasPkt1 + luasPkt2; // ~1,568.11 Ha
  const tanEstet = (data.pkt1_tan || 0) + (data.pkt2_tan || 0);
  const avgYieldEstet = luasEstet > 0 ? tanEstet / luasEstet : 0;
  const totalTargetTanEstet = (targetPkt1 * luasPkt1) + (targetPkt2 * luasPkt2);
  const avgTargetEstet = luasEstet > 0 ? totalTargetTanEstet / luasEstet : 0;
  const pctEstet = totalTargetTanEstet > 0 ? (tanEstet / totalTargetTanEstet) * 100 : 0;
  const targetDiffEstet = avgYieldEstet - avgTargetEstet;
  const ytd2025TanEstet = (data.pkt1_ytd2025 || 0) + (data.pkt2_ytd2025 || 0);
  const ytd2025YieldEstet = luasEstet > 0 ? ytd2025TanEstet / luasEstet : 0;
  const yoyYieldDiffEstet = avgYieldEstet - ytd2025YieldEstet;
  const yoyDiffEstet = ytd2025TanEstet > 0 ? ((tanEstet - ytd2025TanEstet) / ytd2025TanEstet) * 100 : 0;

  // 2. Skop Keseluruhan Termasuk Lot Felda (Grand Total)
  const totalLuasSemua = luasPkt1 + luasPkt2 + luasFelda + luasTambahan; // ~1,666.62 Ha
  const totalTanSemua =
    (tanEstet + (data.felda_tan || 0) + (data.tambahan_tan || 0)) || data.totalTan || 0;
  const totalTan = totalTanSemua;
  const avgYieldSemua = totalLuasSemua > 0 ? totalTanSemua / totalLuasSemua : 0;
  const totalTargetTanSemua =
    targetPkt1 * luasPkt1 +
    targetPkt2 * luasPkt2 +
    targetFelda * luasFelda +
    targetTambahan * luasTambahan;
  const avgTargetSemua = totalLuasSemua > 0 ? totalTargetTanSemua / totalLuasSemua : 0;
  const pctSemua = totalTargetTanSemua > 0 ? (totalTanSemua / totalTargetTanSemua) * 100 : 0;
  const targetDiffSemua = avgYieldSemua - avgTargetSemua;
  const ytd2025YieldSemua =
    totalLuasSemua > 0 ? (data.total_ytd2025 || 0) / totalLuasSemua : 0;
  const yoyYieldDiffSemua = avgYieldSemua - ytd2025YieldSemua;
  const yoyDiffSemua = data.yoy_diff_pct || 0;

  // Tentukan skop aktif (default 'estet' mengikut Pilihan A)
  const isEstetScope = scope === "estet";
  const activeTan = isEstetScope ? tanEstet : totalTanSemua;
  const activeYield = isEstetScope ? avgYieldEstet : avgYieldSemua;
  const activeTarget = isEstetScope ? avgTargetEstet : avgTargetSemua;
  const activePct = isEstetScope ? pctEstet : pctSemua;
  const activeTargetDiff = isEstetScope ? targetDiffEstet : targetDiffSemua;
  const activeYoyYieldDiff = isEstetScope ? yoyYieldDiffEstet : yoyYieldDiffSemua;
  const activeYoyDiff = isEstetScope ? yoyDiffEstet : yoyDiffSemua;

  const totalMuda =
    data.totalMuda ||
    (data.pkt1_muda || 0) + (data.pkt2_muda || 0) + (data.felda_muda || 0) + (data.tambahan_muda || 0);

  const pctPkt1 =
    targetPkt1 > 0 ? ((data.pkt1_tan || 0) / (luasPkt1 || 1) / targetPkt1) * 100 : 0;
  const pctPkt2 =
    targetPkt2 > 0 ? ((data.pkt2_tan || 0) / (luasPkt2 || 1) / targetPkt2) * 100 : 0;
  const pctFelda =
    targetFelda > 0
      ? ((data.felda_tan || 0) / (luasFelda || 1) / targetFelda) * 100
      : 0;
  const pctTambahan =
    targetTambahan > 0
      ? ((data.tambahan_tan || 0) / (luasTambahan || 1) / targetTambahan) * 100
      : 0;

  // Calculate average price for 'harga' type
  const avgPrice = data.avgPrice || 0;
  const price1Pct = data.price1Pct || 0;

  const isAdelaOrTunggal = estateConfig?.id === "FPM_ADELA" || estateConfig?.id === "FPM_TUNGGAL";
  const pkt3Label = isAdelaOrTunggal ? "LOT FELDA" : "PERINGKAT 3";

  const CircularProgress = ({
    percent,
    label,
    delay = 0,
  }: {
    percent: number;
    label: string;
    delay?: number;
  }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset =
      circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            className="text-slate-800"
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, delay: delay, ease: "easeOut" }}
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeLinecap="round"
            className="text-emerald-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.5, duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <span className="text-[8px] font-black text-white leading-none">
              {Math.round(percent)}%
            </span>
            <span className="text-[3px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
              {label}
            </span>
          </motion.div>
        </div>
      </div>
    );
  };

  const showHero = mode === "all" || mode === "hero";
  const showDetails = mode === "all" || mode === "details";
  const isPkt1 = mode === "details-pkt1";
  const isPkt2 = mode === "details-pkt2";
  const isFelda = mode === "details-felda";
  const isTambahan = mode === "details-tambahan";

  // Generate unique data key to trigger transition animations on new data load
  const dataKey = React.useMemo(() => {
    try {
      return `${type}-${period}-${mode}-${scope}-${JSON.stringify(data)}`;
    } catch {
      return `${type}-${period}-${mode}-${scope}`;
    }
  }, [type, period, mode, scope, data]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={dataKey}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{
          duration: 0.45,
          ease: [0.16, 1, 0.3, 1],
          delay: period === "day" ? 0.05 : period === "month" ? 0.1 : 0.15,
        }}
        className="h-full"
      >
      {type === "hasil" && (
        <div className="h-full">
          {/* Hero Summary Card - Condensed to fit */}
          {showHero && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="bg-[#020617] dark:bg-[#020617] p-2 rounded-[16px] border border-slate-800/60 shadow-2xl relative overflow-hidden h-full flex flex-col justify-between"
            >
              {/* Card Header: Title + Icon + Scope Pill */}
              <div className="flex items-center justify-between mb-1.5 opacity-90">
                <div className="flex items-center gap-1">
                  <Calendar size={8} className="text-emerald-500" />
                  <h3 className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                    {period === "day"
                      ? "HARI INI"
                      : period === "month"
                        ? "BULAN INI"
                        : "TAHUN INI (YTD)"}
                  </h3>
                </div>
                {onToggleScope && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleScope(isEstetScope ? "all" : "estet");
                    }}
                    className={`px-1 py-0.5 rounded text-[5px] font-black uppercase tracking-wider transition-all leading-none ${
                      isEstetScope
                        ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 hover:bg-emerald-900"
                        : "bg-blue-950/80 text-blue-300 border border-blue-700/60 hover:bg-blue-900"
                    }`}
                    title={isEstetScope ? "Tekan untuk tukar ke Keseluruhan (+ Lot Felda)" : "Tekan untuk tukar ke Estet Pkt 1 & 2 sahaja"}
                  >
                    {isEstetScope ? "PKT 1 & 2" : "+ FELDA"}
                  </button>
                )}
              </div>

              {/* Main Content Row */}
              <div className="flex items-center justify-between gap-1 mb-2 px-0.5">
                {/* Left: Data Vertical Stack */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col">
                    <p className="text-[5px] font-black text-slate-500 uppercase tracking-tighter leading-none">
                      T/Ha
                    </p>
                    <p className="text-[13px] font-black text-emerald-500 leading-none mt-0.5">
                      {activeYield.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[5px] font-black text-slate-500 uppercase tracking-tighter leading-none">
                      TAN
                    </p>
                    <p className="text-[10px] font-black text-white leading-none mt-0.5">
                      {activeTan.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                {/* Right: Circular Progress (Aligned right) */}
                <div className="relative flex items-center justify-center mr-0.5 shrink-0">
                  <CircularProgress
                    percent={activePct}
                    label="CAPAI"
                    delay={0.2}
                  />
                </div>
              </div>

              {/* Bottom Metrics: Target & vs Target */}
              <div className="pt-1.5 border-t border-slate-800/40 flex justify-between items-end gap-1">
                <div className="flex flex-col shrink-0">
                  <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    TARGET
                  </p>
                  <p className="text-[7.5px] font-black text-white mt-0.5 leading-none">
                    {activeTarget.toFixed(2)}
                    <span className="text-[5px] font-bold text-slate-500 ml-0.5">
                      T/H
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {period === "year" ? "vs YOY 25" : "vs TARGET"}
                  </p>
                  <div
                    className={`flex items-center gap-0.5 mt-0.5 font-black leading-none ${period === "year" ? (activeYoyDiff >= 0 ? "text-emerald-500" : "text-rose-500") : activeTargetDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    <p className="text-[7.5px]">
                      {(period === "year" ? activeYoyYieldDiff : activeTargetDiff) >= 0
                        ? "+"
                        : ""}
                      {Math.abs(
                        period === "year" ? activeYoyYieldDiff : activeTargetDiff,
                      ).toFixed(2)}
                    </p>
                    {period === "year" && (
                      <p className="text-[6px] opacity-80 whitespace-nowrap">
                        ({activeYoyDiff >= 0 ? "+" : ""}
                        {activeYoyDiff.toFixed(0)}%)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Mini Dual-Scope Switcher Strip */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleScope?.(isEstetScope ? "all" : "estet");
                }}
                className="mt-1 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[5px] cursor-pointer transition-colors group select-none"
                title={isEstetScope ? `Klik untuk tukar ke Keseluruhan (+ Lot Felda: ${totalLuasSemua.toFixed(1)} Ha)` : `Klik untuk tukar ke Estet Pkt 1 & 2 sahaja (${luasEstet.toFixed(1)} Ha)`}
              >
                <span className="font-bold text-slate-500 group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                  {isEstetScope ? `+ FELDA (${totalLuasSemua.toFixed(1)}H):` : `ESTET (${luasEstet.toFixed(1)}H):`}
                </span>
                <span className="font-extrabold text-slate-300 group-hover:text-emerald-300 transition-colors">
                  {isEstetScope
                    ? `${totalTanSemua.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} T • ${avgYieldSemua.toFixed(2)} T/H`
                    : `${tanEstet.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} T • ${avgYieldEstet.toFixed(2)} T/H`}
                </span>
              </div>
            </motion.div>
          )}

          {/* Details sections remain largely the same */}
          {(showDetails || isPkt1 || isPkt2 || isFelda || isTambahan) && (
            <div className="flex flex-col gap-1 h-full pt-1.5">
              {(() => {
                const cards = [
                  {
                    id: "pkt1",
                    label: "PERINGKAT 1",
                    tan: data.pkt1_tan || 0,
                    luas: luasPkt1,
                    target: targetPkt1,
                    pct: pctPkt1,
                    yoy: data.pkt1_yoy_diff,
                    visible: (showDetails || isPkt1) && luasPkt1 > 0,
                  },
                  {
                    id: "pkt2",
                    label: "PERINGKAT 2",
                    tan: data.pkt2_tan || 0,
                    luas: luasPkt2,
                    target: targetPkt2,
                    pct: pctPkt2,
                    yoy: data.pkt2_yoy_diff,
                    visible: (showDetails || isPkt2) && luasPkt2 > 0,
                  },
                  {
                    id: "tambahan",
                    label: "LOT TAMBAHAN",
                    tan: data.tambahan_tan || 0,
                    luas: luasTambahan,
                    target: targetTambahan,
                    pct: pctTambahan,
                    yoy: data.tambahan_yoy_diff,
                    visible: (showDetails || isTambahan) && luasTambahan > 0,
                  },
                  {
                    id: "felda",
                    label: pkt3Label,
                    tan: data.felda_tan || 0,
                    luas: luasFelda,
                    target: targetFelda,
                    pct: pctFelda,
                    yoy: data.felda_yoy_diff,
                    visible: (showDetails || isFelda) && luasFelda > 0,
                  },
                ].filter((c) => c.visible);

                return (
                  <>
                    {cards.map((c, index) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
                        className="space-y-0 h-full flex flex-col relative"
                      >
                        {/* ZONE LABEL: Professional Flag Style (Top Left Outside) */}
                        {mode === "details" && period === "day" && (
                          <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                            <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                              <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                                {c.label}
                              </p>
                            </div>
                          </div>
                        )}

                    <div className="bg-white dark:bg-slate-900 p-1.5 rounded-[10px] shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 dark:hover:border-emerald-700 transition-all h-full flex flex-col">
                      {/* HEADER: YoY condensed */}
                      {period === "year" && c.yoy !== undefined && (
                        <div className="flex justify-end mb-0.5">
                          <span
                            className={`text-[6px] font-black flex items-center leading-none ${c.yoy >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {c.yoy >= 0 ? "▲" : "▼"}
                            {Math.abs(c.yoy).toFixed(1)}%
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col flex-1 gap-1">
                        {/* TARGET SECTION - Condensed */}
                        <div className="flex justify-between items-baseline opacity-80">
                          <p className="text-[5.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                            TARGET
                          </p>
                          <div className="flex gap-1.5">
                            <p className="text-[7.5px] font-bold text-slate-700 dark:text-slate-300">
                              {c.target.toFixed(2)}
                              <span className="text-[5px] ml-0.5 opacity-60">
                                T/H
                              </span>
                            </p>
                            <p className="text-[7.5px] font-bold text-slate-700 dark:text-slate-300">
                              {(c.target * (c.luas || 0)).toFixed(0)}
                              <span className="text-[5px] ml-0.5 opacity-60">
                                T
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* CAPAI PERCENTAGE - Single line condensed */}
                        <div className="flex justify-between items-center py-0.5 border-t border-slate-50 dark:border-slate-800/40">
                          <p className="text-[6px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                            CAPAI
                          </p>
                          <span
                            className={`text-[9px] font-black ${c.pct >= 100 ? "text-emerald-500" : c.pct >= 80 ? "text-amber-500" : "text-rose-500"}`}
                          >
                            {c.pct.toFixed(0)}%
                          </span>
                        </div>

                        {/* HERO BOX: THE ACTUALS - Condensed height */}
                        <div className="flex-1 flex items-center justify-center py-1 bg-slate-50/50 dark:bg-white/5 rounded-[8px] border border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="flex items-baseline gap-0.5">
                              <p className="text-[14px] font-black text-emerald-500 leading-none">
                                {(c.tan / (c.luas || 1)).toFixed(2)}
                              </p>
                              <p className="text-[6px] font-bold text-emerald-500 uppercase opacity-70">
                                T/H
                              </p>
                            </div>
                            <div className="flex items-baseline gap-0.5 opacity-70">
                              <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 leading-none">
                                {c.tan.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                              <p className="text-[5.5px] font-bold text-slate-500 dark:text-slate-400 uppercase opacity-60">
                                T
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}</>);
              })()}
            </div>
          )}
        </div>
      )}

      {type === "muda" && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Total Muda (Consistent Layout) */}
          {showHero && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="bg-[#0b1224] p-1.5 rounded-xl shadow-lg border border-white/5 relative overflow-hidden group h-full flex flex-col"
            >
              {/* Info Header */}
              <div className="bg-slate-800/40 px-2 py-0.5 rounded-lg border border-white/5 mb-1 flex items-center justify-between">
                <p className="text-[5.5px] font-black text-slate-500 uppercase tracking-widest">
                  INFO
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-[6.5px] font-black text-rose-400 uppercase tracking-tighter">
                    KATEGORI: MUDA
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-1 pb-0.5 relative">
                {/* Status Badge */}
                <div className="absolute top-0 right-0 px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[7px] font-black z-10">
                  ALERT
                </div>

                {/* Body Left: Donut Chart with Hero Total */}
                <div className="h-14 w-14 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "MUDA", value: totalMuda, fill: "#f43f5e" },
                          {
                            name: "Normal",
                            value: Math.max(1, totalTan * 20),
                            fill: "#1e293b",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={18}
                        outerRadius={24}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationBegin={200}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-[8px] font-black text-white leading-none">
                      {totalMuda}
                    </p>
                    <p className="text-[4px] font-bold text-rose-500 uppercase mt-0.5">
                      BTS
                    </p>
                  </div>
                </div>

                {/* Body Right: Data Box */}
                <div className="flex-1 bg-white/5 p-1 px-1.5 rounded-lg border border-white/5 flex flex-col justify-center h-full">
                  <p className="text-[6px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                    CAPAI
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-[6px] font-black text-rose-400 leading-none">
                      {totalMuda}
                      <span className="text-[3.5px] ml-0.5 opacity-60">
                        BTS
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda || isTambahan) && (
            <div className="flex flex-col gap-1 h-full pt-1.5">
              
              {(showDetails || isPkt1) && luasPkt1 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 1
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-rose-600 dark:text-rose-400">
                        {data.pkt1_muda || 0}
                      </p>
                      <p className="text-[6px] font-bold text-slate-400 uppercase">
                        Tandan
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isPkt2) && luasPkt2 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 2
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-rose-600 dark:text-rose-400">
                        {data.pkt2_muda || 0}
                      </p>
                      <p className="text-[6px] font-bold text-slate-400 uppercase">
                        Tandan
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isTambahan) && luasTambahan > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          LOT TAMBAHAN
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-rose-600 dark:text-rose-400">
                        {data.tambahan_muda || 0}
                      </p>
                      <p className="text-[6px] font-bold text-slate-400 uppercase">
                        Tandan
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isFelda) && luasFelda > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          {pkt3Label}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-rose-600 dark:text-rose-400">
                        {data.felda_muda || 0}
                      </p>
                      <p className="text-[6px] font-bold text-slate-400 uppercase">
                        Tandan
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {type === "kpa_kpg" && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - KPA/KPG Match (Consistent Layout) */}
          {showHero && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="bg-[#0b1224] p-1.5 rounded-xl shadow-lg border border-white/5 relative overflow-hidden group h-full flex flex-col"
            >
              {/* Header: Total Resit (KPA) */}
              <div className="bg-slate-800/40 px-2 py-0.5 rounded-lg border border-white/5 mb-1 flex items-center justify-between">
                <p className="text-[5.5px] font-black text-slate-500 uppercase tracking-widest">
                  TOTAL KPA
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-[6.5px] font-black text-slate-300">
                    {data.totalResit}
                    <span className="text-[4.5px] ml-0.5 opacity-60">
                      RESIT
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-1 pb-0.5 relative">
                {/* Match Badge */}
                {data.totalResit > 0 && (
                  <div
                    className={`absolute top-0 right-0 px-1 py-0.5 rounded text-[7px] font-black z-10 ${(data.kpgMatchCount / data.totalResit) * 100 >= 80 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}
                  >
                    {((data.kpgMatchCount / data.totalResit) * 100).toFixed(0)}%
                  </div>
                )}

                {/* Body Left: Donut with Match Count as Hero */}
                <div className="h-14 w-14 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "KPG",
                            value: data.kpgMatchCount,
                            fill: "#10b981",
                          },
                          {
                            name: "Lain",
                            value: Math.max(
                              0,
                              data.totalResit - data.kpgMatchCount,
                            ),
                            fill: "#1e293b",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={18}
                        outerRadius={24}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationBegin={300}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full">
                    <p className="text-[8px] font-black text-white leading-none tracking-tighter">
                      {data.kpgMatchCount}
                    </p>
                    <p className="text-[4px] font-black text-emerald-400 uppercase leading-none mt-0.5">
                      RESIT
                    </p>
                  </div>
                </div>

                {/* Body Right: Data Box */}
                <div className="flex-1 bg-white/5 p-1 px-1.5 rounded-lg border border-white/5 flex flex-col justify-center h-full">
                  <p className="text-[5.5px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                    CAPAI
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-[4.2px] font-black text-emerald-400 leading-none">
                      {data.kpgMatchTan.toFixed(1)}
                      <span className="text-[2.5px] ml-0.5 opacity-60">
                        TAN
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda || isTambahan) && (
            <div className="flex flex-col gap-1 h-full pt-1.5">
              
              {(showDetails || isPkt1) && luasPkt1 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 1
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        {data.pkt1_kpg_match || 0}
                        <span className="text-[7px] text-emerald-600/50 ml-1">
                          / {data.pkt1_resit || 0}
                        </span>
                      </p>
                      <p className="text-[6px] font-bold text-emerald-500 uppercase">
                        Resit
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isPkt2) && luasPkt2 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 2
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        {data.pkt2_kpg_match || 0}
                        <span className="text-[7px] text-emerald-600/50 ml-1">
                          / {data.pkt2_resit || 0}
                        </span>
                      </p>
                      <p className="text-[6px] font-bold text-emerald-500 uppercase">
                        Resit
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isTambahan) && luasTambahan > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          LOT TAMBAHAN
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        {data.tambahan_kpg_match || 0}
                        <span className="text-[7px] text-emerald-600/50 ml-1">
                          / {data.tambahan_resit || 0}
                        </span>
                      </p>
                      <p className="text-[6px] font-bold text-emerald-500 uppercase">
                        Resit
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {(showDetails || isFelda) && luasFelda > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          {pkt3Label}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                        {data.felda_kpg_match || 0}
                        <span className="text-[7px] text-emerald-600/50 ml-1">
                          / {data.felda_resit || 0}
                        </span>
                      </p>
                      <p className="text-[6px] font-bold text-emerald-500 uppercase">
                        Resit
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {type === "harga" && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Average Price */}
          {showHero && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full"
            >
              <div className="relative z-10">
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-display font-black text-white">
                    RM {avgPrice.toFixed(2)}
                  </p>
                </div>
                <div className="mt-1 pt-1 border-t border-white/5">
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">
                    Harga 1% (OER)
                  </p>
                  <p className="text-[10px] font-black text-emerald-400">
                    RM {price1Pct.toFixed(4)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda || isTambahan) && (
            <div className="flex flex-col gap-1 h-full pt-1.5">
              
              {(showDetails || isPkt1) && luasPkt1 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 1
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      RM {(data.pkt1_avg_price || 0).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              )}
              {(showDetails || isPkt2) && luasPkt2 > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          PERINGKAT 2
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      RM {(data.pkt2_avg_price || 0).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              )}
              {(showDetails || isTambahan) && luasTambahan > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          LOT TAMBAHAN
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      RM {(data.tambahan_avg_price || 0).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              )}
              {(showDetails || isFelda) && luasFelda > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                  className="space-y-0 h-full flex flex-col relative"
                >
                  {showDetails && period === "day" && (
                    <div className="absolute -top-2.5 left-1 z-10 p-0 pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 shadow-md px-1.5 py-0.5 rounded-sm">
                        <p className="text-[6px] font-black text-white uppercase tracking-[0.1em] leading-none">
                          {pkt3Label}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center mt-1">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      RM {(data.felda_avg_price || 0).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
      {type === "efb" && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Total EFB */}
          {showHero && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-1 mb-1.5 opacity-90">
                  <Calendar size={8} className="text-emerald-500" />
                  <h3 className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none">
                    {period === "day"
                      ? "HARI INI"
                      : period === "month"
                        ? "BULAN INI"
                        : "TAHUN INI"}
                  </h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-[13px] font-display font-black text-white">
                    {data.efb_tan.toFixed(2)}
                  </p>
                  <p className="text-[8px] font-black text-emerald-400 uppercase">
                    Tan
                  </p>
                </div>
                <div className="mt-1 pt-1 border-t border-white/5">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                    Bilangan Resit
                  </p>
                  <p className="text-[10px] font-black text-white">
                    {data.efb_resit}{" "}
                    <span className="text-[7px] opacity-60">RESIT</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
    </AnimatePresence>
  );
};
