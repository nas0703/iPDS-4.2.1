import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, LayoutDashboard, TrendingUp, TrendingDown } from 'lucide-react';
import { MONTHLY_TARGETS_2026 } from '../../../utils/constants';

interface BlockPerformanceRankingProps {
  reportType: string;
  currentHasilTab?: string;
  effectiveReportType: string;
  activeKualitiTab?: string;
  showRanking: boolean;
  setShowRanking: (val: boolean | ((prev: boolean) => boolean)) => void;
  rankingPeriod: 'month' | 'year' | 'yoy';
  setRankingPeriod: (period: 'month' | 'year' | 'yoy') => void;
  analytics: any;
  dashboardDate?: string;
  setDashboardDate?: (date: string) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember"
];

export const BlockPerformanceRanking: React.FC<BlockPerformanceRankingProps> = ({
  reportType,
  currentHasilTab = 'kpi',
  effectiveReportType,
  activeKualitiTab = 'muda',
  showRanking,
  setShowRanking,
  rankingPeriod,
  setRankingPeriod,
  analytics,
  dashboardDate,
  setDashboardDate,
}) => {
  const isVisible =
    (reportType === "hasil" && currentHasilTab === 'analitik') ||
    (reportType !== "hasil" &&
      reportType !== "harga" &&
      reportType !== "efb" &&
      reportType !== "pruning" &&
      reportType !== "merumput" &&
      (reportType !== "kualiti_bts" || activeKualitiTab !== 'penggredan'));

  // Active Month calculation
  const activeMonthIndex = (() => {
    if (dashboardDate && dashboardDate.length >= 7) {
      const m = parseInt(dashboardDate.split("-")[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) return m;
    }
    return new Date().getMonth() + 1;
  })();

  const currentYear = dashboardDate ? dashboardDate.slice(0, 4) : "2026";
  const activeMonthName = MONTH_NAMES[activeMonthIndex - 1] || "Bulan";

  if (!isVisible) return null;

  return (
    <>
      <div className="flex flex-col gap-1 px-1 mt-2">
        <div className="flex justify-between items-center">
          <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Prestasi Blok
          </h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRanking((prev: boolean) => !prev)}
            className={`text-[10px] font-black px-4 py-2 rounded-full border shadow-lg flex gap-2 items-center transition-all duration-500 ${
              showRanking
                ? "bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
            }`}
          >
            {showRanking ? (
              <Trophy size={14} className="text-amber-400" />
            ) : (
              <LayoutDashboard size={14} />
            )}
            {showRanking ? "Ranking Aktif" : "Lihat Ranking"}
          </motion.button>
        </div>

        <AnimatePresence>
          {showRanking && (
            <motion.div
              initial={{
                opacity: 0,
                y: -20,
                scale: 0.8,
                filter: "blur(15px)",
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                y: -20,
                scale: 0.8,
                filter: "blur(15px)",
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
              }}
              className="flex bg-slate-200/40 dark:bg-slate-800/40 backdrop-blur-md p-1.5 rounded-[22px] self-end shadow-inner border border-slate-200/50 dark:border-slate-700/50 relative overflow-hidden"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setRankingPeriod("month")}
                className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 z-10 ${
                  rankingPeriod === "month"
                    ? "text-white"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                }`}
              >
                {rankingPeriod === "month" && (
                  <motion.div
                    layoutId="activePeriod"
                    className="absolute inset-0 bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] rounded-xl -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                Bulan
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setRankingPeriod("year")}
                className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 z-10 ${
                  rankingPeriod === "year"
                    ? "text-white"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                }`}
              >
                {rankingPeriod === "year" && (
                  <motion.div
                    layoutId="activePeriod"
                    className="absolute inset-0 bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] rounded-xl -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                Tahun
              </motion.button>
              {reportType === "hasil" && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRankingPeriod("yoy")}
                  className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 z-10 ${
                    rankingPeriod === "yoy"
                      ? "text-white"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                  }`}
                >
                  {rankingPeriod === "yoy" && (
                    <motion.div
                      layoutId="activePeriod"
                      className="absolute inset-0 bg-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.4)] rounded-xl -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  YOY
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Senarai Blok / Ranking */}
      <motion.div
        layout
        className={`transition-all duration-500 ${
          showRanking
            ? "bg-white dark:bg-slate-900 rounded-[32px] p-2 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-0"
            : "space-y-1"
        }`}
        variants={{
          show: {
            transition: {
              staggerChildren: 0.04,
              delayChildren: 0.02,
            },
          },
        }}
        initial="hidden"
        animate="show"
      >
        <div className="relative">
          <div className="flex items-center gap-2 px-1 pb-2 pt-1 mb-1 relative z-10">
            <div className="w-7 shrink-0 text-center">
              <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {showRanking ? "#" : "Blok"}
              </span>
            </div>
            <div
              className={`flex-1 grid gap-1 ${
                showRanking && reportType === "hasil"
                  ? "grid-cols-5"
                  : "grid-cols-4"
              }`}
            >
              <div className="col-span-1 text-left">
                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                  {showRanking ? "Blok" : "Lot"}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Hari Ini
                </span>
              </div>
              <div className="text-center">
                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Bulan ({activeMonthName.slice(0, 3)})
                </span>
              </div>
              <div className="text-center">
                <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Tahun (YTD)
                </span>
              </div>
              {showRanking && reportType === "hasil" && (
                <div
                  className={`text-center border-l transition-all duration-300 pl-1 ${
                    rankingPeriod === "yoy"
                      ? "bg-blue-500/10 dark:bg-blue-500/20 rounded-md border-blue-500/30"
                      : "border-emerald-100/50 dark:border-slate-800"
                  }`}
                >
                  <span
                    className={`text-[7px] font-black uppercase tracking-widest ${
                      rankingPeriod === "yoy"
                        ? "text-blue-500"
                        : "text-emerald-500"
                    }`}
                  >
                    YOY
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          {(
            (showRanking
              ? analytics[
                  rankingPeriod === "yoy" ? "yoy" : rankingPeriod
                ] || analytics.month
              : analytics.month
            )?.rankedBlok || []
          ).map((s: any, index: number) => {
            if (s.tan === 0 && !showRanking) return null;

            const todayBlok = analytics.day?.blokStats?.find(
              (b: any) => b.blok === s.blok,
            );
            const monthBlok = analytics.month?.blokStats?.find(
              (b: any) => b.blok === s.blok,
            );
            const yearBlok = analytics.year?.blokStats?.find(
              (b: any) => b.blok === s.blok,
            );

            const getTarget = (
              pkt: string,
              period: "day" | "month" | "year",
            ) => {
              const targets = MONTHLY_TARGETS_2026[pkt] || [];
              const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
              const monthIdx = now.getMonth();
              const currentDay = now.getDate();
              const daysInMonth = new Date(
                now.getFullYear(),
                monthIdx + 1,
                0,
              ).getDate();

              if (period === "day")
                return (targets[monthIdx] || 0) / daysInMonth;
              if (period === "month") return targets[monthIdx] || 0;
              if (period === "year") {
                const sumPrevMonths = targets
                  .slice(0, monthIdx)
                  .reduce((a: number, b: number) => a + b, 0);
                const partialMonth =
                  (targets[monthIdx] || 0) * (currentDay / daysInMonth);
                return sumPrevMonths + partialMonth;
              }
              return 0;
            };

            const targetDay = getTarget(s.pkt, "day");
            const targetMonth = getTarget(s.pkt, "month");
            const targetYear = getTarget(s.pkt, "year");

            const pctDay =
              targetDay > 0
                ? ((todayBlok?.yieldHek || 0) / targetDay) * 100
                : 0;
            const pctMonth =
              targetMonth > 0
                ? ((monthBlok?.yieldHek || 0) / targetMonth) * 100
                : 0;
            const pctYear =
              targetYear > 0
                ? ((yearBlok?.yieldHek || 0) / targetYear) * 100
                : 0;

            let kpiColorClass =
              "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500";
            if (effectiveReportType === "muda") {
              if (s.muda < 20)
                kpiColorClass =
                  "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
              else if (s.muda <= 30)
                kpiColorClass =
                  "bg-amber-500 text-white shadow-md shadow-amber-500/20";
              else
                kpiColorClass =
                  "bg-rose-500 text-white shadow-md shadow-rose-500/20";
            } else if (effectiveReportType === "kpa_kpg") {
              if (s.kpg_match_count >= 5)
                kpiColorClass =
                  "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
              else if (s.kpg_match_count >= 3)
                kpiColorClass =
                  "bg-amber-500 text-white shadow-md shadow-amber-500/20";
              else
                kpiColorClass =
                  "bg-rose-500 text-white shadow-md shadow-rose-500/20";
            } else if (reportType === "hasil") {
              if (s.progress_pct >= 90)
                kpiColorClass =
                  "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
              else if (s.progress_pct >= 80)
                kpiColorClass =
                  "bg-amber-500 text-white shadow-md shadow-amber-500/20";
              else
                kpiColorClass =
                  "bg-rose-500 text-white shadow-md shadow-rose-500/20";
            }

            return (
              <motion.div
                layout
                key={s.blok}
                variants={{
                  hidden: {
                    opacity: 0,
                    y: 30,
                    scale: 0.85,
                    filter: "blur(10px)",
                  },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: "blur(0px)",
                  },
                }}
                initial="hidden"
                animate="show"
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  filter: "blur(15px)",
                  transition: { duration: 0.2 },
                }}
                transition={{
                  layout: {
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                    mass: 1,
                  },
                  opacity: {
                    duration: 0.5,
                    ease: "circOut",
                  },
                  y: {
                    type: "spring",
                    stiffness: 450,
                    damping: 30,
                  },
                }}
                whileHover={{
                  scale: 1.01,
                  y: -0.5,
                  transition: { duration: 0.2 },
                }}
                className="bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-emerald-500 dark:hover:border-emerald-400 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/20 -z-10" />
                <div className="flex items-center gap-2">
                  {/* Rank / Indicator */}
                  <motion.div
                    layout="position"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 transition-all duration-500 group-hover:rotate-[10deg] group-hover:scale-105 shadow-inner ${kpiColorClass}`}
                  >
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`blok-${s.blok}`}
                        initial={{
                          y: 15,
                          opacity: 0,
                          rotateX: -90,
                          scale: 0.5,
                        }}
                        animate={{
                          y: 0,
                          opacity: 1,
                          rotateX: 0,
                          scale: 1,
                        }}
                        exit={{
                          y: -15,
                          opacity: 0,
                          rotateX: 90,
                          scale: 0.5,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 900,
                          damping: 25,
                        }}
                      >
                        {showRanking ? index + 1 : s.blok}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>

                  {/* Data Utama */}
                  <div
                    className={`flex-1 grid gap-1 items-center ${
                      showRanking && reportType === "hasil"
                        ? "grid-cols-5"
                        : "grid-cols-4"
                    }`}
                  >
                    <div className="col-span-1">
                      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase leading-none">
                        {s.blok}
                      </p>
                      <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-0.5">
                        {s.pkt === "003"
                          ? "Lot Felda"
                          : `PKT ${s.pkt === "001" ? "1" : "2"}`}
                      </p>
                    </div>

                    {/* HARI */}
                    <div className="text-center border-l border-slate-50 dark:border-slate-800 pl-0.5">
                      {reportType === "hasil" && (
                        <>
                          <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">
                            {(todayBlok?.yieldHek || 0).toFixed(2)}
                          </p>
                          <div className="flex justify-center items-center gap-1 mt-0.5">
                            <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                              {todayBlok?.tan.toFixed(1)} Tan
                            </p>
                          </div>
                          <p
                            className={`text-[7px] font-black mt-0.5 ${
                              pctDay >= 100
                                ? "text-emerald-500"
                                : "text-amber-500"
                            }`}
                          >
                            {pctDay.toFixed(0)}%
                          </p>
                        </>
                      )}
                      {effectiveReportType === "muda" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">
                            {todayBlok?.muda || 0}
                          </p>
                        </div>
                      )}
                      {effectiveReportType === "kpa_kpg" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                            {todayBlok?.kpg_match_count || 0}
                          </p>
                          <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                            {todayBlok?.resit_count
                              ? Math.round(
                                  ((todayBlok.kpg_match_count || 0) /
                                    todayBlok.resit_count) *
                                    100,
                                )
                              : 0}
                            %
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BULAN */}
                    <div
                      className={`text-center border-l border-slate-50 dark:border-slate-800 pl-0.5 transition-all duration-500 rounded-lg ${
                        rankingPeriod === "month" && showRanking
                          ? "bg-emerald-500/10 dark:bg-emerald-500/20 z-20 pb-1 pt-0.5 shadow-sm border border-emerald-500/20"
                          : ""
                      }`}
                    >
                      {reportType === "hasil" && (
                        <>
                          <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">
                            {(monthBlok?.yieldHek || 0).toFixed(2)}
                          </p>
                          <div className="flex justify-center items-center gap-1 mt-0.5">
                            <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                              {monthBlok?.tan.toFixed(1)} Tan
                            </p>
                          </div>
                          <p
                            className={`text-[7px] font-black mt-0.5 ${
                              pctMonth >= 100
                                ? "text-emerald-500"
                                : "text-amber-500"
                            }`}
                          >
                            {pctMonth.toFixed(0)}%
                          </p>
                        </>
                      )}
                      {effectiveReportType === "muda" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">
                            {monthBlok?.muda || 0}
                          </p>
                        </div>
                      )}
                      {effectiveReportType === "kpa_kpg" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                            {monthBlok?.kpg_match_count || 0}
                          </p>
                          <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                            {monthBlok?.resit_count
                              ? Math.round(
                                  ((monthBlok.kpg_match_count || 0) /
                                    monthBlok.resit_count) *
                                    100,
                                )
                              : 0}
                            %
                          </p>
                        </div>
                      )}
                    </div>

                    {/* TAHUN */}
                    <div
                      className={`text-center border-l border-slate-50 dark:border-slate-800 pl-0.5 transition-all duration-500 rounded-lg ${
                        rankingPeriod === "year" && showRanking
                          ? "bg-emerald-500/10 dark:bg-emerald-500/20 z-20 pb-1 pt-0.5 shadow-sm border border-emerald-500/20"
                          : ""
                      }`}
                    >
                      {reportType === "hasil" && (
                        <div className="flex flex-col h-full justify-between">
                          <div>
                            <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">
                              {(yearBlok?.yieldHek || 0).toFixed(2)}
                            </p>
                            <div className="flex justify-center items-center gap-1 mt-0.5">
                              <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                {yearBlok?.tan.toFixed(1)} Tan
                              </p>
                            </div>
                            <p
                              className={`text-[7px] font-black mt-0.5 ${
                                pctYear >= 100
                                  ? "text-emerald-500"
                                  : "text-amber-500"
                              }`}
                            >
                              {pctYear.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      )}
                      {effectiveReportType === "muda" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">
                            {yearBlok?.muda || 0}
                          </p>
                        </div>
                      )}
                      {effectiveReportType === "kpa_kpg" && (
                        <div className="flex flex-col items-center">
                          <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                            {yearBlok?.kpg_match_count || 0}
                          </p>
                          <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                            {yearBlok?.resit_count
                              ? Math.round(
                                  ((yearBlok.kpg_match_count || 0) /
                                    yearBlok.resit_count) *
                                    100,
                                )
                              : 0}
                            %
                          </p>
                        </div>
                      )}
                    </div>

                    {/* YOY Info */}
                    {showRanking && reportType === "hasil" && (
                      <div
                        className={`text-center border-l transition-all duration-500 rounded-lg pl-1 pt-0.5 ${
                          rankingPeriod === "yoy"
                            ? "bg-blue-500/10 dark:bg-blue-500/20 z-20 pb-1 border-blue-500/30"
                            : "border-emerald-100 dark:border-emerald-900/40"
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <span
                            className={`text-[10px] font-black ${
                              rankingPeriod === "yoy"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {(
                              ((yearBlok as any)?.ytd_2025_tan || 0) / s.luas
                            ).toFixed(2)}
                          </span>
                          <div
                            className={`flex items-center gap-0.5 mt-0.5 ${
                              (yearBlok?.yieldHek || 0) -
                                ((yearBlok as any)?.ytd_2025_tan || 0) /
                                  s.luas >=
                              0
                                ? "text-emerald-500 font-black"
                                : "text-rose-500 font-black"
                            }`}
                          >
                            <span className="text-[9px]">
                              {(
                                (yearBlok?.yieldHek || 0) -
                                ((yearBlok as any)?.ytd_2025_tan || 0) / s.luas
                              ).toFixed(2)}
                            </span>
                            {(yearBlok?.yieldHek || 0) -
                              ((yearBlok as any)?.ytd_2025_tan || 0) / s.luas >=
                            0 ? (
                              <TrendingUp size={10} />
                            ) : (
                              <TrendingDown size={10} />
                            )}
                          </div>
                          <div
                            className={`text-[8px] font-black mt-1 px-1.5 py-0.5 rounded-full ${
                              ((yearBlok as any)?.yoy_diff_pct || 0) >= 0
                                ? "bg-emerald-500/20 text-emerald-500"
                                : "bg-rose-500/20 text-rose-500"
                            }`}
                          >
                            {((yearBlok as any)?.yoy_diff_pct || 0) >= 0
                              ? "+"
                              : ""}
                            {(
                              (yearBlok as any)?.yoy_diff_pct || 0
                            ).toFixed(1)}
                            %
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </>
  );
};
