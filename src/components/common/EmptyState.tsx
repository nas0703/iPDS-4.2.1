import React from 'react';
import { Database, Search, AlertCircle, FileX2, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Tiada Data Dijumpai',
  description = 'Tiada rekod data yang sepadan dengan kriteria carian atau tarikh yang dipilih.',
  icon,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`w-full flex flex-col items-center justify-center p-8 md:p-12 bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 shadow-inner">
        {icon || <FileX2 className="w-7 h-7" />}
      </div>
      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed font-medium">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};

export const NoDataRow: React.FC<{ colSpan: number; message?: string }> = ({
  colSpan,
  message = 'Tiada rekod data dijumpai'
}) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <Database className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {message}
        </span>
      </div>
    </td>
  </tr>
);
