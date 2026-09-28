import React from "react";

interface ReportTabProps {
  r: any;
  reportType: string;
  setReportType: (id: any) => void;
  isReordering?: boolean;
  setIsReordering?: (val: boolean) => void;
  longPressTimer?: React.MutableRefObject<any>;
}

export const ReportTab: React.FC<ReportTabProps> = ({
  r,
  reportType,
  setReportType,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportType(r.id);
    const target = e.currentTarget as HTMLElement;
    if (target && typeof target.scrollIntoView === "function") {
      try {
        target.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      } catch (_) {}
    }
  };

  return (
    <button
      type="button"
      data-report-id={r.id}
      onClick={handleClick}
      className={`whitespace-nowrap px-4 py-2 text-[11px] font-black rounded-xl transition-all duration-150 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0 cursor-pointer active:scale-95 touch-manipulation ${
        reportType === r.id
          ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/50 scale-[1.02]"
          : "text-emerald-100/90 bg-slate-900/80 border border-emerald-500/25 hover:text-white hover:bg-emerald-950/60 hover:border-emerald-500/50"
      }`}
    >
      {reportType === r.id && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
      )}
      {r.label}
    </button>
  );
};



