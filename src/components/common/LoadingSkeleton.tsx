import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`} />
);

export const StatCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-3">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={`stat-skel-${idx}`}
        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-[104px]"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="w-20 h-3.5" />
          <Skeleton className="w-7 h-7 rounded-xl" />
        </div>
        <div className="space-y-1.5 mt-2">
          <Skeleton className="w-28 h-6 rounded-md" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 6,
  columns = 6,
  className = ''
}) => (
  <div className={`w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${className}`}>
    {/* Table Header */}
    <div className="flex items-center gap-3 p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
      {Array.from({ length: columns }).map((_, cIdx) => (
        <Skeleton key={`th-skel-${cIdx}`} className="h-4 flex-1" />
      ))}
    </div>
    {/* Table Body */}
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={`tr-skel-${rIdx}`} className="flex items-center gap-3 p-3.5">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={`td-skel-${rIdx}-${cIdx}`}
              className={`h-4 flex-1 ${cIdx === 0 ? 'max-w-[80px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton: React.FC<{ height?: string | number; title?: string }> = ({
  height = 300,
  title
}) => (
  <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        {title ? (
          <span className="text-xs font-black tracking-wider text-slate-400 uppercase">{title}</span>
        ) : (
          <Skeleton className="w-40 h-4" />
        )}
        <Skeleton className="w-24 h-3" />
      </div>
      <Skeleton className="w-20 h-6 rounded-lg" />
    </div>
    <div
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      className="w-full flex items-end justify-between gap-2 pt-8 pb-2 px-2 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl"
    >
      {Array.from({ length: 12 }).map((_, idx) => {
        const heights = ['h-1/3', 'h-1/2', 'h-2/3', 'h-3/4', 'h-4/5', 'h-3/5', 'h-1/2', 'h-4/5', 'h-2/3', 'h-full', 'h-3/4', 'h-1/2'];
        return (
          <div key={`bar-skel-${idx}`} className="flex-1 flex flex-col items-center gap-2">
            <Skeleton className={`w-full max-w-[28px] rounded-t-md ${heights[idx % heights.length]}`} />
            <Skeleton className="w-6 h-2.5" />
          </div>
        );
      })}
    </div>
  </div>
);

export const CardSkeleton: React.FC<{ count?: number; className?: string }> = ({ count = 3, className = '' }) => (
  <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={`card-skel-${idx}`}
        className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-6 h-6 rounded-full" />
        </div>
        <Skeleton className="w-full h-12 rounded-xl" />
        <div className="flex justify-between pt-2">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
    ))}
  </div>
);
