import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Flame,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  Target,
  Truck
} from 'lucide-react';
import { gradingTaskService } from '../services/gradingTaskService';
import type { GradingTask } from '../types/gradingTask';
import { ESTATE_CHANGED_EVENT } from '../../../utils/estateContext';
import { getTodayDateString } from '../../../utils/formatters';

interface GradingTaskViewProps {
  onStartTask: (task: GradingTask) => void;
  refreshKey?: number;
}

const rankBadgeStyle: Record<number, { bg: string; text: string; border: string; label: string }> = {
  1: {
    bg: 'bg-rose-500 text-white shadow-rose-500/25',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20',
    label: 'Utama #1'
  },
  2: {
    bg: 'bg-amber-500 text-white shadow-amber-500/25',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20',
    label: 'Kedua #2'
  },
  3: {
    bg: 'bg-amber-600 text-white shadow-amber-600/25',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    label: 'Ketiga #3'
  },
  4: {
    bg: 'bg-slate-700 text-white shadow-slate-700/25',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    label: 'Keempat #4'
  },
  5: {
    bg: 'bg-slate-600 text-white shadow-slate-600/25',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    label: 'Kelima #5'
  }
};

export const GradingTaskView: React.FC<GradingTaskViewProps> = ({ onStartTask, refreshKey = 0 }) => {
  const [tasks, setTasks] = useState<GradingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTasks(await gradingTaskService.listToday());
    } catch (err: any) {
      setError(err?.message || 'Gagal memuatkan Grading Task.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const handleEstateChange = () => loadTasks();
    window.addEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
    return () => window.removeEventListener(ESTATE_CHANGED_EVENT, handleEstateChange);
  }, [loadTasks, refreshKey]);

  // Aggregate metrics
  const totalMuda7Days = tasks.reduce((sum, t) => sum + (t.cumulative_bts_muda || 0), 0);
  const maxMudaInWindow = Math.max(...tasks.map((t) => t.cumulative_bts_muda), 1);
  const completedCount = tasks.filter((t) => t.status !== 'OPEN').length;
  const verifiedCount = tasks.filter((t) => t.status === 'FINAL_VERIFIED').length;
  const sourceWindow = tasks[0] ? `${tasks[0].source_window_start} hingga ${tasks[0].source_window_end}` : '';

  return (
    <div className="space-y-3">
      {/* 1. Header & Quick Stat Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Target size={12} className="shrink-0" />
              <span>Tugasan Penggredan EQI</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-500 dark:text-slate-400">{getTodayDateString()}</span>
            </div>
            <h2 className="mt-0.5 text-base font-black tracking-tight text-slate-900 dark:text-white">
              Top 5 Ranking BTS Muda (7 Hari)
            </h2>
          </div>

          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            title="Muat semula senarai tugasan"
            className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Segar</span>
          </button>
        </div>

        {/* Compact Summary Metrics */}
        {tasks.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center dark:border-slate-800/80">
            <div className="rounded-xl bg-slate-50 py-1.5 px-2 dark:bg-slate-800/50">
              <p className="text-[9px] font-bold uppercase text-slate-500">Jumlah Muda (7D)</p>
              <p className="text-sm font-black text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                <Flame size={12} /> {totalMuda7Days} <span className="text-[9px] font-normal text-slate-400">tandan</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 py-1.5 px-2 dark:bg-slate-800/50">
              <p className="text-[9px] font-bold uppercase text-slate-500">Status Tindakan</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                {completedCount}/{tasks.length} <span className="text-[9px] font-medium text-slate-400">Selesai</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 py-1.5 px-2 dark:bg-slate-800/50">
              <p className="text-[9px] font-bold uppercase text-slate-500">Pengesahan Kilang</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {verifiedCount} <span className="text-[9px] font-medium text-slate-400">Lulus KPG</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Arahan Penggredan EQI (Mission Directives Banner) */}
      <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/10 via-emerald-900/5 to-transparent p-3 dark:border-emerald-500/20 dark:from-emerald-950/30">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Info size={13} />
            </div>
            <div>
              <p className="text-xs font-black tracking-tight text-slate-900 dark:text-emerald-200">
                Arahan Operasi Penggredan EQI di Lapangan
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Prosedur wajib sebelum BTS dihantar ke kilang sawit
              </p>
            </div>
          </div>
          <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showInstructions && (
          <div className="mt-2.5 space-y-1.5 border-t border-emerald-500/20 pt-2 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                1
              </span>
              <p>
                <strong className="text-slate-900 dark:text-white">Keutamaan Turun Padang:</strong> Periksa platform blok mengikut urutan <strong>Ranking #1 hingga #5</strong> yang dikenal pasti paling kerap menghantar BTS muda sepanjang 7 hari lepas.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                2
              </span>
              <p>
                <strong className="text-slate-900 dark:text-white">Pemeriksaan Fizikal & Tandan Tinggal:</strong> Gred minima 50-100 tandan di platform/lori. Asingkan buah muda/hitam dan catat tandan yang ditinggalkan di platform.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                3
              </span>
              <p>
                <strong className="text-slate-900 dark:text-white">Padanan No. Lori:</strong> Pastikan <strong>Nombor Lori</strong> direkodkan dengan tepat dalam borang penggredan bagi membolehkan sistem memadankan keputusan penarafan kilang (KPG vs KPA) secara automatik.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Empty State */}
      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <ClipboardCheck className="mx-auto text-slate-400" size={26} />
          <p className="mt-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
            Tiada Tugasan Dijana
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Tiada rekod BTS muda layak dalam tetingkap D-7 hingga D-1.
          </p>
        </div>
      )}

      {/* 5. Compact Ranking Visual Distribution (Bar) */}
      {tasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2.5">
            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
              <Layers size={11} /> Ranking Keterukan (7 Hari)
            </span>
            <span className="text-[9px] font-mono text-slate-400 shrink-0">{sourceWindow}</span>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => {
              const pct = Math.round((task.cumulative_bts_muda / maxMudaInWindow) * 100);
              const isResolved = task.status !== 'OPEN';
              return (
                <div key={`bar-${task.id}`} className="flex items-center gap-2 text-[10px]">
                  <span className="w-13 shrink-0 truncate font-bold text-slate-700 dark:text-slate-300">
                    Blok {task.block}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        task.rank === 1
                          ? 'bg-rose-500'
                          : task.rank === 2
                          ? 'bg-amber-500'
                          : task.rank === 3
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    {task.cumulative_bts_muda} <span className="text-[9px] font-medium text-slate-500">tandan</span>
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right text-[9px] font-black uppercase ${
                      isResolved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                    }`}
                  >
                    {isResolved ? 'Selesai' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Compact Task Action Cards */}
      <div className="space-y-2.5">
        {tasks.map((task) => {
          const badge = rankBadgeStyle[task.rank] || rankBadgeStyle[5];
          const isOpen = task.status === 'OPEN';
          const isFieldResolved = task.status === 'FIELD_RESOLVED';
          const isVerified = task.status === 'FINAL_VERIFIED';

          return (
            <article
              key={task.id}
              className={`rounded-2xl border transition-all p-3 shadow-sm ${badge.border}`}
            >
              {/* Row: Rank Badge, Block Name, Resit Count, Action Button / Status */}
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow ${badge.bg}`}
                  >
                    #{task.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Blok {task.block}
                      </h4>
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                        {task.cumulative_bts_muda} BTS Muda
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {task.source_receipt_count} resit dikesan (7 hari)
                    </p>
                  </div>
                </div>

                {/* Right side: Button at end of row */}
                <div className="shrink-0">
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => onStartTask(task)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-sm shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
                    >
                      <span>Gred Blok {task.block}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                  {isFieldResolved && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[9px] font-black uppercase text-sky-700 dark:text-sky-300">
                      <Clock size={10} /> Padanan Kilang
                    </span>
                  )}
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={10} /> Disahkan
                    </span>
                  )}
                </div>
              </div>

              {/* Resolved State Details */}
              {!isOpen && (
                <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-[10px] dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500">Gred Lapangan:</span>{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {task.field_grade || '-'} ({task.field_muda_count ?? 0} muda)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Lori Lapangan:</span>{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        {task.field_lorry || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">KPG / KPA:</span>{' '}
                      <strong className="font-mono text-slate-900 dark:text-white">
                        {task.mill_kpg ?? '-'}/{task.mill_kpa ?? '-'}
                      </strong>
                    </div>
                  </div>

                  {isVerified && (
                    <p className="mt-1.5 flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={12} /> KPG kilang ({task.mill_kpg}%) mencapai KPA ({task.mill_kpa}%). Resit #{task.matched_no_resit || 'Kilang'} disahkan.
                    </p>
                  )}

                  {isFieldResolved && task.kpg_achieved === false && (
                    <p className="mt-1.5 flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                      <AlertTriangle size={12} /> KPG kilang ({task.mill_kpg}%) di bawah sasaran KPA ({task.mill_kpa}%).
                    </p>
                  )}

                  {isFieldResolved && task.kpg_achieved === null && (
                    <p className="mt-1.5 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Truck size={12} /> Lori sedang dalam perjalanan atau menunggu kemasukan resit kilang.
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
