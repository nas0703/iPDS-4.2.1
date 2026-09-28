import React from 'react';
import { Plus, Minus, Lock } from 'lucide-react';
import { playSound } from '../../../utils/sound';

interface StepperControlProps {
  label: string;
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  max?: number;
  quickSteps?: number[]; // e.g. [5, 10, 50]
  unit?: 'T' | 'B';
  onToggleUnit?: () => void;
  subtitle?: string;
  theme?: 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'slate';
  disabled?: boolean;
}

export const StepperControl: React.FC<StepperControlProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 99999,
  quickSteps = [],
  unit,
  onToggleUnit,
  subtitle,
  theme = 'slate',
  disabled = false
}) => {
  const handleDecrement = (amount: number = 1) => {
    if (disabled) return;
    playSound('decrement');
    const nextVal = Math.max(min, Number(value || 0) - amount);
    onChange(nextVal);
  };

  const handleIncrement = (amount: number = 1) => {
    if (disabled) return;
    playSound('increment');
    const nextVal = Math.min(max, Number(value || 0) + amount);
    onChange(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value;
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
  };

  // Standardized & natural theme styling maps (Unified elegant style)
  const themeStyles = {
    emerald: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20',
      badge: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    },
    rose: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-rose-600 dark:text-rose-400',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20',
      badge: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
    },
    amber: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-amber-600 dark:text-amber-400',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20',
      badge: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
    },
    sky: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-sky-600 dark:text-sky-400',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20',
      badge: 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30'
    },
    indigo: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-indigo-600 dark:text-indigo-400',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20',
      badge: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
    },
    slate: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      text: 'text-slate-700 dark:text-slate-300',
      btnMinus: 'bg-slate-200 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      btnPlus: 'bg-slate-600 hover:bg-slate-500 text-white shadow-md shadow-slate-600/20',
      badge: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30'
    }
  };

  const st = themeStyles[theme] || themeStyles.slate;

  return (
    <div className={`p-2 sm:p-2.5 rounded-xl border ${st.border} ${st.bg} space-y-1 transition-all shadow-sm ${disabled ? 'opacity-95' : ''}`}>
      {/* Label Row */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 leading-tight truncate">
              {label}
            </span>
            {disabled && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[8px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded" title="Dikira automatik daripada Kategori Muda">
                <Lock size={9} /> Auto
              </span>
            )}
          </div>
          {subtitle && (
            <span className="block text-[8px] sm:text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">
              {subtitle}
            </span>
          )}
        </div>

        {unit && onToggleUnit && (
          <button
            type="button"
            onClick={() => {
              playSound('toggle');
              onToggleUnit();
            }}
            disabled={disabled}
            className={`px-2 py-0.5 text-[10px] font-black rounded-md border uppercase transition-transform active:scale-95 ${st.badge}`}
            title="Tukar unit: T = Tandan, B = Buah"
          >
            ({unit})
          </button>
        )}
      </div>

      {/* Main Row: Input on Left, Unified +/- Action Group on Right */}
      <div className="flex items-center gap-1.5">
        {/* Input Box (Left Side) */}
        <div className="relative flex-1 min-w-[60px]">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            readOnly={disabled}
            className={`w-full text-center text-lg font-black h-8 sm:h-9 rounded-lg border ${
              disabled
                ? 'bg-slate-100 dark:bg-slate-800/80 text-rose-600 dark:text-rose-400 border-slate-300/80 dark:border-slate-700 cursor-not-allowed select-none'
                : `bg-white dark:bg-slate-900 ${st.text} border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner`
            }`}
          />
        </div>

        {/* Unified +/- Control Section (Right Side - Single Action Box) */}
        <div className={`flex items-center gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800/90 rounded-lg border border-slate-300 dark:border-slate-700/80 shrink-0 shadow-inner ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Main Minus Button */}
          <button
            type="button"
            onClick={() => handleDecrement(1)}
            disabled={disabled || value <= min}
            className={`w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center rounded-md font-extrabold border transition-all active:scale-90 disabled:opacity-40 ${st.btnMinus}`}
            title="Tolak 1"
            aria-label={`Tolak 1 ${label}`}
          >
            <Minus size={15} strokeWidth={3} />
          </button>

          {/* Main Plus Button */}
          <button
            type="button"
            onClick={() => handleIncrement(1)}
            disabled={disabled || value >= max}
            className={`w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center rounded-md font-extrabold shadow-md transition-all active:scale-90 disabled:opacity-40 ${st.btnPlus}`}
            title="Tambah 1"
            aria-label={`Tambah 1 ${label}`}
          >
            <Plus size={15} strokeWidth={3} />
          </button>

          {/* Quick step buttons grouped together */}
          {quickSteps.map(stepVal => (
            <button
              key={`plus-${stepVal}`}
              type="button"
              onClick={() => handleIncrement(stepVal)}
              disabled={disabled || value >= max}
              className="px-2 h-8 flex items-center justify-center rounded-md text-[10px] font-black bg-slate-300 dark:bg-slate-700/80 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-all active:scale-90 disabled:opacity-40"
              title={`Tambah +${stepVal}`}
            >
              +{stepVal}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
